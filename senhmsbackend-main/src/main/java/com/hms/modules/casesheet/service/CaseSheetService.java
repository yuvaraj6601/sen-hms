package com.hms.modules.casesheet.service;

import com.hms.exception.ResourceNotFoundException;
import com.hms.modules.admission.enums.AdmissionStatus;
import com.hms.modules.admission.repository.AdmissionRepository;
import com.hms.modules.casesheet.dto.*;
import com.hms.modules.casesheet.entity.Medication;
import com.hms.modules.casesheet.entity.Observation;
import com.hms.modules.casesheet.entity.VitalSign;
import com.hms.modules.casesheet.enums.MedicationStatus;
import com.hms.modules.casesheet.enums.ObservationType;
import com.hms.modules.casesheet.repository.MedicationRepository;
import com.hms.modules.casesheet.repository.ObservationRepository;
import com.hms.modules.casesheet.repository.VitalSignRepository;
import com.hms.common.AuditLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class CaseSheetService {

    private final ObservationRepository obsRepo;
    private final MedicationRepository medRepo;
    private final VitalSignRepository vitalRepo;
    private final AuditLogService auditLogService;
    private final AdmissionRepository admissionRepo;

    // ════════════════════════════════════════════════════════
    // OBSERVATIONS
    // ════════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public List<ObservationResponse> getObservationsByPatient(Long patientId) {
        return obsRepo.findByPatientIdOrderByDateDescTimeDesc(patientId)
                .stream().map(this::toObsResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<ObservationResponse> getObservationsByAdmission(Long admissionId) {
        return obsRepo.findByAdmissionIdOrderByDateDescTimeDesc(admissionId)
                .stream().map(this::toObsResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<ObservationResponse> getObservationsByVisit(Long visitId) {
        return obsRepo.findByVisitIdOrderByDateDescTimeDesc(visitId)
                .stream().map(this::toObsResponse).toList();
    }

    public ObservationResponse addObservation(ObservationRequest req) {
        log.info("[CASESHEET] addObservation patientId={} type={} by='{}'", req.getPatientId(), req.getType(), req.getDoctorName());
        guardNotDischarged(req.getAdmissionId(), "add an observation to");
        Observation obs = Observation.builder()
                .patientId(req.getPatientId())
                .uhid(req.getUhid())
                .admissionId(req.getAdmissionId())
                .visitId(req.getVisitId())
                .date(req.getDate())
                .time(req.getTime())
                .doctorName(req.getDoctorName())
                .doctorId(req.getDoctorId())
                .type(req.getType() != null ? req.getType() : ObservationType.ROUND)
                .chiefComplaint(req.getChiefComplaint())
                .clinicalFindings(req.getClinicalFindings())
                .diagnosis(req.getDiagnosis())
                .plan(req.getPlan())
                .notes(req.getNotes())
                .build();
        ObservationResponse obsSaved = toObsResponse(obsRepo.save(obs));
        auditLogService.log("Observation", obsSaved.getId(), "CREATE", currentUser(), "patientId=" + obsSaved.getPatientId() + " type=" + obsSaved.getType());
        return obsSaved;
    }

    // ════════════════════════════════════════════════════════
    // MEDICATIONS
    // ════════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public List<MedicationResponse> getMedicationsByPatient(Long patientId) {
        return medRepo.findByPatientIdOrderByDateDescTimeDesc(patientId)
                .stream().map(this::toMedResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<MedicationResponse> getMedicationsByAdmission(Long admissionId) {
        return medRepo.findByAdmissionIdOrderByDateDescTimeDesc(admissionId)
                .stream().map(this::toMedResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<MedicationResponse> getMedicationsByVisit(Long visitId) {
        return medRepo.findByVisitIdOrderByDateDescTimeDesc(visitId)
                .stream().map(this::toMedResponse).toList();
    }

    public MedicationResponse prescribe(MedicationRequest req) {
        log.info("[CASESHEET] prescribe patientId={} drug='{}' by='{}'", req.getPatientId(), req.getDrugName(), req.getPrescribedBy());
        guardNotDischarged(req.getAdmissionId(), "prescribe medication to");
        Medication med = Medication.builder()
                .patientId(req.getPatientId())
                .uhid(req.getUhid())
                .admissionId(req.getAdmissionId())
                .visitId(req.getVisitId())
                .date(req.getDate())
                .time(req.getTime())
                .prescribedBy(req.getPrescribedBy())
                .prescribedById(req.getPrescribedById())
                .drugName(req.getDrugName())
                .dosage(req.getDosage())
                .frequency(req.getFrequency())
                .route(req.getRoute() != null ? req.getRoute()
                        : com.hms.modules.casesheet.enums.MedicationRoute.ORAL)
                .duration(req.getDuration())
                .instructions(req.getInstructions())
                .status(MedicationStatus.ACTIVE)
                .build();
        MedicationResponse medSaved = toMedResponse(medRepo.save(med));
        auditLogService.log("Medication", medSaved.getId(), "PRESCRIBE", currentUser(), "patientId=" + medSaved.getPatientId() + " drug=" + medSaved.getDrugName());
        return medSaved;
    }

    public MedicationResponse stopMedication(Long id, StopMedicationRequest req) {
        log.info("[CASESHEET] stopMedication id={} by='{}'", id, req.getStoppedBy());
        Medication med = medRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Medication", id));
        med.setStatus(MedicationStatus.STOPPED);
        med.setStoppedOn(LocalDate.now());
        med.setStoppedReason(req.getReason());
        med.setStoppedBy(req.getStoppedBy());
        MedicationResponse medSaved = toMedResponse(medRepo.save(med));
        auditLogService.log("Medication", medSaved.getId(), "PRESCRIBE", currentUser(), "patientId=" + medSaved.getPatientId() + " drug=" + medSaved.getDrugName());
        return medSaved;
    }

    // ════════════════════════════════════════════════════════
    // VITAL SIGNS
    // ════════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public List<VitalSignResponse> getVitalsByPatient(Long patientId) {
        return vitalRepo.findByPatientIdOrderByRecordedAtDesc(patientId)
                .stream().map(this::toVitalResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<VitalSignResponse> getVitalsByAdmission(Long admissionId) {
        return vitalRepo.findByAdmissionIdOrderByRecordedAtDesc(admissionId)
                .stream().map(this::toVitalResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<VitalSignResponse> getVitalsByVisit(Long visitId) {
        return vitalRepo.findByVisitIdOrderByRecordedAtDesc(visitId)
                .stream().map(this::toVitalResponse).toList();
    }

    public VitalSignResponse recordVitals(VitalSignRequest req) {
        log.info("[CASESHEET] recordVitals patientId={} by='{}'", req.getPatientId(), req.getRecordedBy());
        guardNotDischarged(req.getAdmissionId(), "record vitals for");
        VitalSign vital = VitalSign.builder()
                .patientId(req.getPatientId())
                .uhid(req.getUhid())
                .admissionId(req.getAdmissionId())
                .visitId(req.getVisitId())
                .recordedAt(req.getRecordedAt())
                .recordedBy(req.getRecordedBy())
                .bloodPressure(req.getBloodPressure())
                .pulse(req.getPulse())
                .temperature(req.getTemperature())
                .spo2(req.getSpo2())
                .respiratoryRate(req.getRespiratoryRate())
                .weight(req.getWeight())
                .height(req.getHeight())
                .bloodGlucose(req.getBloodGlucose())
                .notes(req.getNotes())
                .build();
        VitalSignResponse vitalSaved = toVitalResponse(vitalRepo.save(vital));
        auditLogService.log("VitalSign", vitalSaved.getId(), "RECORD", currentUser(), "patientId=" + vitalSaved.getPatientId());
        return vitalSaved;
    }

    // ── Mappers ───────────────────────────────────────────────────────────────

    private ObservationResponse toObsResponse(Observation o) {
        ObservationResponse r = new ObservationResponse();
        r.setId(o.getId());
        r.setPatientId(o.getPatientId());
        r.setUhid(o.getUhid());
        r.setAdmissionId(o.getAdmissionId());
        r.setVisitId(o.getVisitId());
        r.setDate(o.getDate());
        r.setTime(o.getTime());
        r.setDoctorName(o.getDoctorName());
        r.setDoctorId(o.getDoctorId());
        r.setType(o.getType());
        r.setChiefComplaint(o.getChiefComplaint());
        r.setClinicalFindings(o.getClinicalFindings());
        r.setDiagnosis(o.getDiagnosis());
        r.setPlan(o.getPlan());
        r.setNotes(o.getNotes());
        r.setCreatedBy(o.getCreatedBy());
        r.setCreatedAt(o.getCreatedAt());
        r.setUpdatedAt(o.getUpdatedAt());
        return r;
    }

    private MedicationResponse toMedResponse(Medication m) {
        MedicationResponse r = new MedicationResponse();
        r.setId(m.getId());
        r.setPatientId(m.getPatientId());
        r.setUhid(m.getUhid());
        r.setAdmissionId(m.getAdmissionId());
        r.setVisitId(m.getVisitId());
        r.setDate(m.getDate());
        r.setTime(m.getTime());
        r.setPrescribedBy(m.getPrescribedBy());
        r.setPrescribedById(m.getPrescribedById());
        r.setDrugName(m.getDrugName());
        r.setDosage(m.getDosage());
        r.setFrequency(m.getFrequency());
        r.setRoute(m.getRoute());
        r.setDuration(m.getDuration());
        r.setInstructions(m.getInstructions());
        r.setStatus(m.getStatus());
        r.setStoppedOn(m.getStoppedOn());
        r.setStoppedReason(m.getStoppedReason());
        r.setStoppedBy(m.getStoppedBy());
        r.setCreatedBy(m.getCreatedBy());
        r.setCreatedAt(m.getCreatedAt());
        r.setUpdatedAt(m.getUpdatedAt());
        return r;
    }

    private VitalSignResponse toVitalResponse(VitalSign v) {
        VitalSignResponse r = new VitalSignResponse();
        r.setId(v.getId());
        r.setPatientId(v.getPatientId());
        r.setUhid(v.getUhid());
        r.setAdmissionId(v.getAdmissionId());
        r.setVisitId(v.getVisitId());
        r.setRecordedAt(v.getRecordedAt());
        r.setRecordedBy(v.getRecordedBy());
        r.setBloodPressure(v.getBloodPressure());
        r.setPulse(v.getPulse());
        r.setTemperature(v.getTemperature());
        r.setSpo2(v.getSpo2());
        r.setRespiratoryRate(v.getRespiratoryRate());
        r.setWeight(v.getWeight());
        r.setHeight(v.getHeight());
        r.setBloodGlucose(v.getBloodGlucose());
        r.setNotes(v.getNotes());
        r.setCreatedBy(v.getCreatedBy());
        r.setCreatedAt(v.getCreatedAt());
        r.setUpdatedAt(v.getUpdatedAt());
        return r;
    }

    // ── Guard: prevent writes to a discharged admission ───────────────────────

    /**
     * Throws IllegalStateException if the given admissionId refers to a
     * DISCHARGED admission. Skips the check when admissionId is null
     * (e.g. OP-visit-only records that have no admissionId).
     */
    private void guardNotDischarged(Long admissionId, String action) {
        if (admissionId == null) return;
        admissionRepo.findById(admissionId).ifPresent(a -> {
            if (a.getStatus() == AdmissionStatus.DISCHARGED) {
                throw new IllegalStateException(
                        "Cannot " + action + " admission " + a.getAdmissionNo()
                        + " — it is already discharged.");
            }
        });
    }

    private String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return "system";
        }
        return auth.getPrincipal().toString();
    }
}