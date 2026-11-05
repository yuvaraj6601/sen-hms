package com.hms.modules.discharge.service;

import com.hms.modules.discharge.dto.DischargeSummaryRequest;
import com.hms.modules.discharge.dto.DischargeSummaryResponse;
import com.hms.modules.discharge.entity.DischargeSummary;
import com.hms.modules.discharge.repository.DischargeSummaryRepository;
import jakarta.persistence.EntityNotFoundException;
import com.hms.common.AuditLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class DischargeSummaryService {

    private final DischargeSummaryRepository repo;
    private final AuditLogService auditLogService;

    // ── GET by admission ──────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public DischargeSummaryResponse getByAdmissionId(Long admissionId) {
        DischargeSummary ds = repo.findByAdmissionId(admissionId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "No discharge summary found for admissionId=" + admissionId));
        return toResponse(ds);
    }

    // ── GET by id ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public DischargeSummaryResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    // ── CREATE ────────────────────────────────────────────────────────────────

    @Transactional
    public DischargeSummaryResponse create(DischargeSummaryRequest req) {
        log.info("[DISCHARGE_SUMMARY] create admissionId={} patient='{}'", req.getAdmissionId(), req.getPatientName());
        if (repo.existsByAdmissionId(req.getAdmissionId())) {
            throw new IllegalStateException(
                    "A discharge summary already exists for admissionId=" + req.getAdmissionId()
                            + ". Use PUT to update it.");
        }
        DischargeSummary ds = map(new DischargeSummary(), req);
        DischargeSummaryResponse dsSaved = toResponse(repo.save(ds));
        auditLogService.log("DischargeSummary", dsSaved.getId(), dsSaved.getAdmissionId() != null ? "SAVE" : "SAVE", currentUser(), "admissionId=" + dsSaved.getAdmissionId() + " patient=" + dsSaved.getPatientName());
        return dsSaved;
    }

    // ── UPSERT (create or update) ─────────────────────────────────────────────

    @Transactional
    public DischargeSummaryResponse upsert(DischargeSummaryRequest req) {
        log.info("[DISCHARGE_SUMMARY] upsert admissionId={}", req.getAdmissionId());
        DischargeSummary ds = repo.findByAdmissionId(req.getAdmissionId())
                .orElse(new DischargeSummary());
        map(ds, req);
        DischargeSummaryResponse dsSaved = toResponse(repo.save(ds));
        auditLogService.log("DischargeSummary", dsSaved.getId(), dsSaved.getAdmissionId() != null ? "SAVE" : "SAVE", currentUser(), "admissionId=" + dsSaved.getAdmissionId() + " patient=" + dsSaved.getPatientName());
        return dsSaved;
    }

    // ── UPDATE ────────────────────────────────────────────────────────────────

    @Transactional
    public DischargeSummaryResponse update(Long id, DischargeSummaryRequest req) {
        log.info("[DISCHARGE_SUMMARY] update id={}", id);
        DischargeSummary ds = findOrThrow(id);
        map(ds, req);
        DischargeSummaryResponse dsSaved = toResponse(repo.save(ds));
        auditLogService.log("DischargeSummary", dsSaved.getId(), dsSaved.getAdmissionId() != null ? "SAVE" : "SAVE", currentUser(), "admissionId=" + dsSaved.getAdmissionId() + " patient=" + dsSaved.getPatientName());
        return dsSaved;
    }

    // ── DELETE ────────────────────────────────────────────────────────────────

    @Transactional
    public void delete(Long id) {
        log.info("[DISCHARGE_SUMMARY] delete id={}", id);
        repo.delete(findOrThrow(id));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private DischargeSummary findOrThrow(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("DischargeSummary not found: " + id));
    }

    private DischargeSummary map(DischargeSummary ds, DischargeSummaryRequest req) {
        ds.setAdmissionId(req.getAdmissionId());
        if (req.getAdmissionNo()    != null) ds.setAdmissionNo(req.getAdmissionNo());
        if (req.getPatientId()      != null) ds.setPatientId(req.getPatientId());
        if (req.getUhid()           != null) ds.setUhid(req.getUhid());

        ds.setPatientName(req.getPatientName());
        ds.setAgeSex(req.getAgeSex());
        ds.setIpNo(req.getIpNo());
        ds.setRoomNo(req.getRoomNo());
        ds.setConsultantName(req.getConsultantName());
        ds.setInsuranceName(req.getInsuranceName());
        ds.setClaimNo(req.getClaimNo());
        ds.setDateOfAdmission(req.getDateOfAdmission());
        ds.setTimeOfAdmission(req.getTimeOfAdmission());
        ds.setDateOfDischarge(req.getDateOfDischarge());
        ds.setTimeOfDischarge(req.getTimeOfDischarge());

        ds.setFinalDiagnosis(req.getFinalDiagnosis());
        ds.setChiefComplaints(req.getChiefComplaints());
        ds.setHistoryOfPresentIllness(req.getHistoryOfPresentIllness());
        ds.setPastHistory(req.getPastHistory());
        ds.setClinicalExamination(req.getClinicalExamination());
        ds.setInvestigations(req.getInvestigations());
        ds.setPulmonaryFunctionTest(req.getPulmonaryFunctionTest());
        ds.setHospitalCourse(req.getHospitalCourse());
        ds.setTreatmentInHospital(req.getTreatmentInHospital());
        ds.setConditionAtDischarge(req.getConditionAtDischarge());
        ds.setDischargeMedication(req.getDischargeMedication());
        ds.setDischargeAdvice(req.getDischargeAdvice());
        ds.setFollowUp(req.getFollowUp());
        ds.setConsultantDesignation(req.getConsultantDesignation());
        return ds;
    }

    private DischargeSummaryResponse toResponse(DischargeSummary ds) {
        DischargeSummaryResponse r = new DischargeSummaryResponse();
        r.setId(ds.getId());
        r.setAdmissionId(ds.getAdmissionId());
        r.setAdmissionNo(ds.getAdmissionNo());
        r.setPatientId(ds.getPatientId());
        r.setUhid(ds.getUhid());

        r.setPatientName(ds.getPatientName());
        r.setAgeSex(ds.getAgeSex());
        r.setIpNo(ds.getIpNo());
        r.setRoomNo(ds.getRoomNo());
        r.setConsultantName(ds.getConsultantName());
        r.setInsuranceName(ds.getInsuranceName());
        r.setClaimNo(ds.getClaimNo());
        r.setDateOfAdmission(ds.getDateOfAdmission());
        r.setTimeOfAdmission(ds.getTimeOfAdmission());
        r.setDateOfDischarge(ds.getDateOfDischarge());
        r.setTimeOfDischarge(ds.getTimeOfDischarge());

        r.setFinalDiagnosis(ds.getFinalDiagnosis());
        r.setChiefComplaints(ds.getChiefComplaints());
        r.setHistoryOfPresentIllness(ds.getHistoryOfPresentIllness());
        r.setPastHistory(ds.getPastHistory());
        r.setClinicalExamination(ds.getClinicalExamination());
        r.setInvestigations(ds.getInvestigations());
        r.setPulmonaryFunctionTest(ds.getPulmonaryFunctionTest());
        r.setHospitalCourse(ds.getHospitalCourse());
        r.setTreatmentInHospital(ds.getTreatmentInHospital());
        r.setConditionAtDischarge(ds.getConditionAtDischarge());
        r.setDischargeMedication(ds.getDischargeMedication());
        r.setDischargeAdvice(ds.getDischargeAdvice());
        r.setFollowUp(ds.getFollowUp());
        r.setConsultantDesignation(ds.getConsultantDesignation());

        r.setCreatedBy(ds.getCreatedBy());
        r.setCreatedAt(ds.getCreatedAt());
        r.setUpdatedBy(ds.getUpdatedBy());
        r.setUpdatedAt(ds.getUpdatedAt());
        return r;
    }

    private String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return "system";
        }
        return auth.getPrincipal().toString();
    }
}