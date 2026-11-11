package com.hms.modules.casesheet.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.hms.exception.ResourceNotFoundException;
import com.hms.modules.admission.entity.Admission;
import com.hms.modules.admission.repository.AdmissionRepository;
import com.hms.modules.casesheet.client.CaseSheetAiClient;
import com.hms.modules.casesheet.dto.*;
import com.hms.modules.casesheet.enums.ObservationType;
import com.hms.modules.casesheet.enums.RecordSource;
import com.hms.modules.discharge.dto.DischargeSummaryRequest;
import com.hms.modules.discharge.service.DischargeSummaryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;

/** "Upload Report" — AI reads a scanned case sheet into observations, vitals and a discharge summary. */
@Slf4j
@Service
@RequiredArgsConstructor
public class CaseSheetReportService {

    private static final Set<String> TYPES = Set.of("application/pdf", "image/jpeg", "image/png", "image/webp");
    private static final long MAX_BYTES = 20L * 1024 * 1024;
    private static final DateTimeFormatter DMY = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final CaseSheetAiClient ai;
    private final AdmissionRepository admissionRepo;
    private final CaseSheetService caseSheetService;
    private final DischargeSummaryService dischargeSummaryService;

    /** Reads the file; nothing is saved and the file is not stored. */
    public CaseSheetDraftResponse draft(Long admissionId, MultipartFile file) {
        Admission admission = findAdmission(admissionId);
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Case sheet file is required");
        }
        String type = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        if (type.equals("image/jpg")) type = "image/jpeg";
        if (!TYPES.contains(type)) {
            throw new IllegalArgumentException("Only PDF, JPG, PNG or WEBP files are accepted");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("File is too large (max 20 MB)");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            log.error("[CASESHEET] could not read uploaded report", ex);
            throw new IllegalArgumentException("Could not read the file");
        }
        log.info("[CASESHEET] report draft admissionId={} type={} sizeBytes={}", admissionId, type, bytes.length);
        CaseSheetDraftResponse draft = ai.extractCaseSheet(bytes, file.getOriginalFilename(), type, admission.getAdmissionDate());
        if (draft.getObservations().isEmpty() && draft.getVitals().isEmpty() && draft.getDischargeSummary() == null) {
            throw new IllegalArgumentException("Nothing could be read from this document. Try a clearer scan.");
        }
        return draft;
    }

    /** Saves the reviewed draft in one transaction. */
    @Transactional
    public CaseSheetImportResponse importDraft(Long admissionId, CaseSheetImportRequest req) {
        Admission a = findAdmission(admissionId);
        int obsCount = 0;
        for (ObservationRequest o : req.getObservations()) {
            o.setPatientId(a.getPatientId());
            o.setUhid(a.getUhid());
            o.setAdmissionId(a.getId());
            o.setVisitId(null);
            if (o.getDate() == null) o.setDate(a.getAdmissionDate() != null ? a.getAdmissionDate() : LocalDate.now());
            if (blank(o.getTime())) o.setTime("00:00");
            if (blank(o.getDoctorName())) o.setDoctorName(orDash(a.getAdmittingDoctorName()));
            if (blank(o.getChiefComplaint())) o.setChiefComplaint("-");
            if (blank(o.getDiagnosis())) o.setDiagnosis(orDash(a.getProvisionalDiagnosis()));
            if (o.getType() == null) o.setType(ObservationType.ROUND);
            o.setSource(RecordSource.AI_UPLOAD);
            caseSheetService.addObservation(o);
            obsCount++;
        }
        int vitalCount = 0;
        for (VitalSignRequest v : req.getVitals()) {
            if (v.getRecordedAt() == null) continue;   // a vitals row without a time cannot be charted
            v.setPatientId(a.getPatientId());
            v.setUhid(a.getUhid());
            v.setAdmissionId(a.getId());
            v.setVisitId(null);
            if (blank(v.getRecordedBy())) v.setRecordedBy("Nursing staff");
            v.setSource(RecordSource.AI_UPLOAD);
            caseSheetService.recordVitals(v);
            vitalCount++;
        }
        boolean dsSaved = false;
        if (req.getDischargeSummary() != null && req.getDischargeSummary().isObject()) {
            dischargeSummaryService.upsert(toDischargeRequest(a, req.getDischargeSummary()));
            dsSaved = true;
        }
        log.info("[CASESHEET] report imported admissionId={} observations={} vitals={} discharge={}",
                admissionId, obsCount, vitalCount, dsSaved);
        return new CaseSheetImportResponse(obsCount, vitalCount, dsSaved);
    }

    private DischargeSummaryRequest toDischargeRequest(Admission a, JsonNode j) {
        DischargeSummaryRequest r = new DischargeSummaryRequest();
        r.setAdmissionId(a.getId());
        r.setAdmissionNo(a.getAdmissionNo());
        r.setPatientId(a.getPatientId());
        r.setUhid(a.getUhid());
        r.setPatientName(or(s(j, "Patient Name"), a.getPatientName()));
        r.setAgeSex(s(j, "Age / Sex"));
        r.setIpNo(or(s(j, "IP No"), a.getAdmissionNo()));
        r.setRoomNo(a.getBedNumber());
        r.setConsultantName(or(s(j, "Consultant"), a.getAdmittingDoctorName()));
        r.setIcuConsultant(s(j, "Icu Consultant"));
        r.setDrugAllergy(s(j, "Drug Allergy"));
        r.setDateOfAdmission(or(dmy(s(j, "Date of Admission")), a.getAdmissionDate()));
        r.setTimeOfAdmission(cut(or(s(j, "Time of Admission"), a.getAdmissionTime()), 10));
        r.setDateOfDischarge(dmy(s(j, "Date of Discharge")));
        r.setTimeOfDischarge(cut(s(j, "Time of Discharge"), 10));
        r.setFinalDiagnosis(s(j, "FINAL DIAGNOSIS"));
        r.setChiefComplaints(s(j, "CHIEF COMPLAINTS"));
        r.setHistoryOfPresentIllness(s(j, "HISTORY OF PRESENT ILLNESS"));
        r.setPastHistory(flat(j.get("MEDICAL & PERSONAL HISTORY")));
        r.setClinicalExamination(flat(j.get("PHYSICAL EXAMINATION & VITAL SIGNS (At Admission)")));
        r.setInvestigations(join(flat(j.get("INVESTIGATION")),
                s(j, "COMBINED DIAGNOSTIC IMPRESSION & LAB SUMMARY") == null ? null
                        : "Impression: " + s(j, "COMBINED DIAGNOSTIC IMPRESSION & LAB SUMMARY")));
        r.setHospitalCourse(s(j, "HOSPITAL COURSE & CLINICAL PROGRESS"));
        r.setTreatmentInHospital(s(j, "TREATMENT GIVEN DURING HOSPITAL STAY"));
        r.setConditionAtDischarge(s(j, "CONDITION AT DISCHARGE"));
        r.setDischargeMedication(s(j, "DISCHARGE MEDICATIONS"));
        r.setDischargeAdvice(join(flat(j.get("DISCHARGE ADVICE")),
                s(j, "RED FLAG WARNINGS") == null ? null : "Red flag warnings: " + s(j, "RED FLAG WARNINGS")));
        r.setFollowUp(flat(j.get("FOLLOW-UP PLAN")));
        r.setStructuredJson(j.toString());
        return r;
    }

    /** Nested section → "Key: value" lines, skipping empty values. */
    private static String flat(JsonNode n) {
        if (n == null || n.isNull()) return null;
        if (!n.isObject()) return n.asText().isBlank() ? null : n.asText().trim();
        StringBuilder sb = new StringBuilder();
        flatInto(n, sb, "");
        return sb.isEmpty() ? null : sb.toString().trim();
    }

    private static void flatInto(JsonNode n, StringBuilder sb, String indent) {
        Iterator<Map.Entry<String, JsonNode>> it = n.fields();
        while (it.hasNext()) {
            Map.Entry<String, JsonNode> e = it.next();
            JsonNode v = e.getValue();
            if (v.isObject()) {
                StringBuilder inner = new StringBuilder();
                flatInto(v, inner, indent + "  ");
                if (!inner.isEmpty()) sb.append(indent).append(e.getKey()).append(":\n").append(inner);
            } else if (!v.isNull() && !v.asText().isBlank()) {
                sb.append(indent).append(e.getKey()).append(": ").append(v.asText().trim()).append('\n');
            }
        }
    }

    private Admission findAdmission(Long admissionId) {
        return admissionRepo.findById(admissionId)
                .orElseThrow(() -> new ResourceNotFoundException("Admission", admissionId));
    }

    private static String s(JsonNode j, String key) {
        JsonNode v = j.get(key);
        return v == null || v.isNull() || v.isObject() || v.asText().isBlank() ? null : v.asText().trim();
    }

    private static LocalDate dmy(String v) {
        if (v == null) return null;
        try {
            return LocalDate.parse(v, DMY);
        } catch (Exception ex) {
            try {
                return LocalDate.parse(v);
            } catch (Exception ignored) {
                return null;
            }
        }
    }

    private static String join(String a, String b) {
        if (a == null) return b;
        return b == null ? a : a + "\n\n" + b;
    }

    private static <T> T or(T v, T fallback) {
        return v != null ? v : fallback;
    }

    private static String cut(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static String orDash(String s) {
        return blank(s) ? "-" : s;
    }
}
