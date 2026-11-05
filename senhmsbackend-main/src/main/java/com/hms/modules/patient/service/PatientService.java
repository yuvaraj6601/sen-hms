package com.hms.modules.patient.service;

import com.hms.common.AuditLogService;
import com.hms.exception.DuplicateResourceException;
import com.hms.exception.ResourceNotFoundException;
import com.hms.modules.admission.dto.AdmissionRequest;
import com.hms.modules.admission.dto.AdmissionResponse;
import com.hms.modules.admission.repository.AdmissionRepository;
import com.hms.modules.admission.service.AdmissionService;
import com.hms.modules.opvisit.repository.OPVisitRepository;
import com.hms.modules.patient.dto.PatientRequest;
import com.hms.modules.patient.dto.RegisterAdmitResponse;
import com.hms.modules.patient.dto.PatientResponse;
import com.hms.modules.patient.dto.PatientSummaryResponse;
import com.hms.modules.patient.dto.PatientCountsResponse;
import com.hms.modules.patient.entity.Patient;
import com.hms.modules.patient.enums.PatientType;
import com.hms.modules.patient.repository.PatientRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class PatientService {

    private final PatientRepository repo;
    private final AuditLogService auditLogService;
    private final AdmissionService admissionService;
    private final AdmissionRepository admissionRepository;
    private final OPVisitRepository opVisitRepository;

    // ── Search / list ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<PatientSummaryResponse> search(String search, List<PatientType> patientTypes,
                                               Boolean active, LocalDate dateFrom, LocalDate dateTo,
                                               Pageable pageable) {
        log.debug("[PATIENT] search query='{}' types={} active={} from={} to={}",
                search, patientTypes, active, dateFrom, dateTo);
        // "All" / no type filter → match every type. We pass ALL enum values
        // (OP/IP/BOTH) instead of null so the JPQL `IN :patientTypes` always
        // receives a non-empty list — the same usage pattern this codebase uses
        // for every other `IN :list` query — keeping it robust across Hibernate
        // versions. `IN (all values)` is equivalent to no filter.
        List<PatientType> types = (patientTypes != null && !patientTypes.isEmpty())
                ? patientTypes
                : List.of(PatientType.values());
        // Convert LocalDate boundaries to inclusive LocalDateTime bounds so a single
        // "From date" covers the whole start day and "To date" covers the whole end day.
        LocalDateTime from = dateFrom != null ? dateFrom.atStartOfDay() : null;
        LocalDateTime to = dateTo != null ? dateTo.atTime(LocalTime.MAX) : null;
        Page<Patient> page = repo.search(
                StringUtils.hasText(search) ? search : null,
                types, active, from, to, pageable
        );

        // ── Enrich with current-episode info in TWO bulk queries (no N+1) ──────
        // Active admissions keyed by patientId; latest OP visits keyed by uhid.
        List<Patient> patients = page.getContent();
        Map<Long, PatientSummaryResponse.CurrentEpisode> ipEpisodes = loadActiveAdmissionEpisodes(patients);
        Map<String, PatientSummaryResponse.CurrentEpisode> opEpisodes = loadLatestVisitEpisodes(patients);

        return page.map(p -> {
            PatientSummaryResponse s = toSummary(p);
            // Prefer the active admission (patient is physically in the hospital);
            // fall back to the latest OP visit for the "where/when last seen" view.
            PatientSummaryResponse.CurrentEpisode episode = ipEpisodes.get(p.getId());
            if (episode == null) episode = opEpisodes.get(p.getUhid());
            s.setCurrentEpisode(episode);
            return s;
        });
    }

    /** Build patientId → active-admission episode map from one bulk query. */
    private Map<Long, PatientSummaryResponse.CurrentEpisode> loadActiveAdmissionEpisodes(List<Patient> patients) {
        List<Long> ids = patients.stream().map(Patient::getId).collect(Collectors.toList());
        if (ids.isEmpty()) return Map.of();
        Map<Long, PatientSummaryResponse.CurrentEpisode> map = new HashMap<>();
        // Rows ordered admissionDate DESC — keep the first (most recent) per patient.
        for (Object[] row : admissionRepository.findActiveEpisodesForPatients(ids)) {
            Long patientId = (Long) row[0];
            if (map.containsKey(patientId)) continue;
            PatientSummaryResponse.CurrentEpisode e = new PatientSummaryResponse.CurrentEpisode();
            e.setKind("IP");
            e.setEpisodeNo((String) row[1]);
            e.setEpisodeDate((LocalDate) row[2]);
            e.setWardName((String) row[3]);
            e.setBedNumber((String) row[4]);
            e.setStatus(row[5] != null ? row[5].toString() : null);
            e.setInsurance(row[6] != null && (Boolean) row[6]);
            e.setInsuranceStatus(row[7] != null ? row[7].toString() : null);
            e.setAdmissionId((Long) row[8]);
            map.put(patientId, e);
        }
        return map;
    }

    /** Build uhid → latest OP-visit episode map from one bulk query. */
    private Map<String, PatientSummaryResponse.CurrentEpisode> loadLatestVisitEpisodes(List<Patient> patients) {
        List<String> uhids = patients.stream().map(Patient::getUhid).collect(Collectors.toList());
        if (uhids.isEmpty()) return Map.of();
        Map<String, PatientSummaryResponse.CurrentEpisode> map = new HashMap<>();
        // Rows ordered visitDate DESC, id DESC — keep the first (latest) per uhid.
        for (Object[] row : opVisitRepository.findLatestVisitsForUhids(uhids)) {
            String uhid = (String) row[0];
            if (map.containsKey(uhid)) continue;
            PatientSummaryResponse.CurrentEpisode e = new PatientSummaryResponse.CurrentEpisode();
            e.setKind("OP");
            e.setEpisodeNo((String) row[1]);
            e.setTokenNo((String) row[2]);
            e.setEpisodeDate((LocalDate) row[3]);
            e.setStatus(row[4] != null ? row[4].toString() : null);
            map.put(uhid, e);
        }
        return map;
    }

    // ── Counts by patient type (filter-dropdown totals) ───────────────────────

    @Transactional(readOnly = true)
    public PatientCountsResponse counts() {
        long op = 0, ip = 0, both = 0;
        for (Object[] row : repo.countByType()) {
            PatientType t = (PatientType) row[0];
            long c = (Long) row[1];
            switch (t) {
                case OP   -> op   = c;
                case IP   -> ip   = c;
                case BOTH -> both = c;
            }
        }
        PatientCountsResponse r = new PatientCountsResponse();
        r.setAll(op + ip + both);
        r.setOp(op);
        r.setIp(ip);
        r.setBoth(both);
        return r;
    }

    // ── Single record ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PatientResponse getById(Long id) {
        log.debug("[PATIENT] getById id={}", id);
        return toResponse(findOrThrow(id));
    }

    @Transactional(readOnly = true)
    public PatientResponse getByUhid(String uhid) {
        log.debug("[PATIENT] getByUhid uhid={}", uhid);
        return toResponse(
                repo.findByUhid(uhid)
                        .orElseThrow(() -> new ResourceNotFoundException("Patient with UHID " + uhid + " not found"))
        );
    }

    // ── Create ────────────────────────────────────────────────────────────────

    public PatientResponse create(PatientRequest req) {
        log.info("[PATIENT] Creating patient name='{}' phone={}", req.getName(), req.getPhone());

        // ── Phone duplicate check ─────────────────────────────────────────────
        // If a patient already exists with this phone number, block creation and
        // return the existing patient's name so the caller can search manually.
        // Placeholder phones ("0000000000") are excluded from this check.
        String incomingPhone = req.getPhone();
        if (StringUtils.hasText(incomingPhone) && !incomingPhone.equals("0000000000")) {
            repo.findFirstByPhoneOrderByIdAsc(incomingPhone).ifPresent(existing -> {
                throw new DuplicateResourceException(
                        "PATIENT_EXISTS:" + existing.getName()
                                + " (" + existing.getUhid() + ")");
            });
        }

        String uhid = generateUhid();

        Patient patient = Patient.builder()
                .uhid(uhid)
                .name(req.getName())
                .dateOfBirth(req.getDateOfBirth())
                .age(req.getAge())
                .gender(req.getGender())
                .bloodGroup(req.getBloodGroup())
                .maritalStatus(req.getMaritalStatus())
                .religion(req.getReligion())
                .nationality(req.getNationality())
                .phone(req.getPhone())
                .alternatePhone(req.getAlternatePhone())
                .email(req.getEmail())
                .address(req.getAddress())
                .area(req.getArea())
                .district(req.getDistrict())
                .state(req.getState())
                .pinCode(req.getPinCode())
                .illness(req.getIllness())
                .referredBy(req.getReferredBy())
                .referrerId(req.getReferrerId())
                .doctorName(req.getDoctorName())
                .doctorId(req.getDoctorId())
                .department(req.getDepartment())
                .patientType(req.getPatientType() != null ? req.getPatientType() : PatientType.OP)
                .insuranceCompany(req.getInsuranceCompany())
                .insuranceCompanyId(req.getInsuranceCompanyId())
                .policyNo(req.getPolicyNo())
                .tpaName(req.getTpaName())
                .attendantName(req.getAttendantName())
                .attendantRelation(req.getAttendantRelation())
                .attendantPhone(req.getAttendantPhone())
                .idProofType(req.getIdProofType())
                .idProofNo(req.getIdProofNo())
                .notes(req.getNotes())
                .active(true)
                .build();

        Patient saved = repo.save(patient);
        log.info("[PATIENT] Created uhid={} id={}", saved.getUhid(), saved.getId());
        auditLogService.log("Patient", saved.getId(), "CREATE", currentUser(),
                "uhid=" + saved.getUhid() + " name=" + saved.getName());
        return toResponse(saved);
    }

    // ── Register + admit (atomic) ──────────────────────────────────────────────

    /**
     * Register a brand-new IN-patient AND admit them in ONE transaction.
     *
     * Both the patient row and the admission (including bed reservation, ward
     * occupancy bump, patient-type flip and audit logs performed by
     * {@link AdmissionService#admit}) either all commit together or all roll
     * back. This avoids the orphaned "patient with no admission" state the old
     * two-call flow could leave behind if the second call failed.
     *
     * Reuses the existing create/admit logic — no business rule is duplicated.
     */
    public RegisterAdmitResponse registerAndAdmit(PatientRequest patientReq, AdmissionRequest admissionReq) {
        log.info("[PATIENT] registerAndAdmit name='{}' ward={} bed={}",
                patientReq.getName(), admissionReq.getWardId(), admissionReq.getBedId());

        // Ward + bed are mandatory for an admission. The nested AdmissionRequest
        // is @NotNull but intentionally NOT @Valid here (its @NotNull patientId
        // would fail — the id is assigned below), so the field-level ward/bed
        // constraints are not bean-validated on this endpoint. Guard explicitly
        // with clear messages before anything is persisted (method is
        // transactional, so a throw rolls back the whole operation).
        if (admissionReq.getWardId() == null) {
            throw new IllegalArgumentException("Ward is required to admit the patient.");
        }
        if (admissionReq.getBedId() == null) {
            throw new IllegalArgumentException("Bed is required to admit the patient.");
        }

        // 1. Create the patient (UHID assigned, duplicate-phone guard applies).
        PatientResponse patient = create(patientReq);

        // 2. Admit — link to the freshly created patient id.
        admissionReq.setPatientId(patient.getId());
        AdmissionResponse admission = admissionService.admit(admissionReq);

        // Re-read the patient so the response reflects the IP type set by admit().
        return new RegisterAdmitResponse(getById(patient.getId()), admission);
    }

    // ── Update ────────────────────────────────────────────────────────────────

    public PatientResponse update(Long id, PatientRequest req) {
        log.info("[PATIENT] Updating id={} name='{}'", id, req.getName());
        Patient patient = findOrThrow(id);

        // ── Guard: one-time demographic correction after admission ────────────
        // Demographic edits are unlimited while the patient has NO active
        // admission (OP corrections captured hastily at registration). Once an
        // active (non-discharged) admission exists, the patient entity may be
        // corrected exactly ONCE — regardless of the admit path (OP admit /
        // patient-list admit / register-and-admit) — after which it is locked.
        // Admission-level identity (name snapshot, insurance for the episode)
        // continues to be corrected through the Admission edit flow
        // (PUT /api/admissions/{id}). Enforced server-side so a direct API call
        // cannot bypass the UI lock.
        boolean isAdmitted = admissionRepository.findActiveByPatientId(id).isPresent();
        if (isAdmitted && patient.isPostAdmitEdited()) {
            throw new IllegalStateException(
                    "This patient's details have already been corrected once after admission. "
                            + "Further admission-specific changes must be made on the Admission "
                            + "Details screen.");
        }

        // ── Mobile number: Admin / Managing Director only ─────────────────────
        // The mobile number is the patient's identity / de-duplication key (new
        // registrations are matched by phone) and the SMS channel, so a change is
        // restricted to Admin / Managing Director. For all other roles
        // (Receptionist, etc.) any incoming phone value is ignored and the stored
        // number is preserved. (alternatePhone remains freely editable by all.)
        if (StringUtils.hasText(req.getPhone())
                && !req.getPhone().trim().equals(patient.getPhone())) {
            if (currentUserIsAdmin()) {
                patient.setPhone(req.getPhone().trim());
            } else {
                throw new IllegalStateException(
                        "Only an Admin or Managing Director can change the patient's mobile number.");
            }
        }

        patient.setName(req.getName());
        patient.setDateOfBirth(req.getDateOfBirth());
        patient.setAge(req.getAge());
        patient.setGender(req.getGender());
        patient.setBloodGroup(req.getBloodGroup());
        patient.setMaritalStatus(req.getMaritalStatus());
        patient.setReligion(req.getReligion());
        patient.setNationality(req.getNationality());
        // phone intentionally NOT updated — see note above.
        patient.setAlternatePhone(req.getAlternatePhone());
        patient.setEmail(req.getEmail());
        patient.setAddress(req.getAddress());
        patient.setArea(req.getArea());
        patient.setDistrict(req.getDistrict());
        patient.setState(req.getState());
        patient.setPinCode(req.getPinCode());
        patient.setIllness(req.getIllness());
        patient.setReferredBy(req.getReferredBy());
        patient.setReferrerId(req.getReferrerId());
        patient.setDoctorName(req.getDoctorName());
        patient.setDoctorId(req.getDoctorId());
        patient.setDepartment(req.getDepartment());
        patient.setPatientType(req.getPatientType() != null ? req.getPatientType() : patient.getPatientType());
        patient.setInsuranceCompany(req.getInsuranceCompany());
        patient.setInsuranceCompanyId(req.getInsuranceCompanyId());
        patient.setPolicyNo(req.getPolicyNo());
        patient.setTpaName(req.getTpaName());
        patient.setAttendantName(req.getAttendantName());
        patient.setAttendantRelation(req.getAttendantRelation());
        patient.setAttendantPhone(req.getAttendantPhone());
        patient.setIdProofType(req.getIdProofType());
        patient.setIdProofNo(req.getIdProofNo());
        patient.setNotes(req.getNotes());

        // Consume the one-time post-admission correction. Edits made while the
        // patient has no active admission do NOT consume it, so the single
        // post-admission correction is still available later if needed.
        if (isAdmitted) {
            patient.setPostAdmitEdited(true);
        }

        Patient saved = repo.save(patient);
        log.info("[PATIENT] Updated id={} uhid={} postAdmitEdited={}",
                saved.getId(), saved.getUhid(), saved.isPostAdmitEdited());
        auditLogService.log("Patient", saved.getId(), "UPDATE", currentUser(),
                "uhid=" + saved.getUhid() + " name=" + saved.getName());

        // NOTE: free / surgical / mlc are per-admission facts and are NO LONGER
        // relayed through the patient edit. They are owned by the Admission edit
        // flow (PUT /api/admissions/{id}) via the "Admission Details" tab, which
        // keeps the patient and admission edits on separate, dedicated APIs.

        return toResponse(saved);
    }

    // ── Toggle active status ──────────────────────────────────────────────────

    public PatientResponse toggleStatus(Long id) {
        Patient patient = findOrThrow(id);
        boolean newStatus = !patient.isActive();
        patient.setActive(newStatus);
        Patient saved = repo.save(patient);
        log.info("[PATIENT] ToggleStatus id={} uhid={} active={}", id, saved.getUhid(), newStatus);
        auditLogService.log("Patient", id, "TOGGLE_STATUS", currentUser(),
                "uhid=" + saved.getUhid() + " active=" + newStatus);
        return toResponse(saved);
    }

    // ── UHID generation ───────────────────────────────────────────────────────

    private String generateUhid() {
        String datePrefix = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        int seq = repo.findMaxUhidSeqForDate(datePrefix) + 1;
        return String.format("UHID-%s-%05d", datePrefix, seq);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Patient findOrThrow(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Patient", id));
    }

    private String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return "system";
        }
        return auth.getPrincipal().toString();
    }

    /**
     * True when the current JWT caller is an Admin or Managing Director.
     * The JWT carries the role enum name, so the authority is ROLE_ADMIN /
     * ROLE_MANAGING_DIRECTOR; the display forms are tolerated defensively.
     */
    private boolean currentUserIsAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return false;
        return auth.getAuthorities().stream()
                .map(a -> a.getAuthority())
                .anyMatch(a -> a.equals("ROLE_ADMIN")
                        || a.equals("ROLE_MANAGING_DIRECTOR")
                        || a.equals("ROLE_Admin")
                        || a.equals("ROLE_Managing Director"));
    }

    private PatientSummaryResponse toSummary(Patient p) {
        PatientSummaryResponse s = new PatientSummaryResponse();
        s.setId(p.getId());
        s.setUhid(p.getUhid());
        s.setName(p.getName());
        s.setDateOfBirth(p.getDateOfBirth());
        s.setAge(p.getAge());
        s.setGender(p.getGender());
        s.setPhone(p.getPhone());
        s.setDoctorName(p.getDoctorName());
        s.setDepartment(p.getDepartment());
        s.setPatientType(p.getPatientType());
        s.setActive(p.isActive());
        s.setCreatedAt(p.getCreatedAt());
        return s;
    }

    private PatientResponse toResponse(Patient p) {
        PatientResponse r = new PatientResponse();
        r.setId(p.getId());
        r.setUhid(p.getUhid());
        r.setName(p.getName());
        r.setDateOfBirth(p.getDateOfBirth());
        r.setAge(p.getAge());
        r.setGender(p.getGender());
        r.setBloodGroup(p.getBloodGroup());
        r.setMaritalStatus(p.getMaritalStatus());
        r.setReligion(p.getReligion());
        r.setNationality(p.getNationality());
        r.setPhone(p.getPhone());
        r.setAlternatePhone(p.getAlternatePhone());
        r.setEmail(p.getEmail());
        r.setAddress(p.getAddress());
        r.setArea(p.getArea());
        r.setDistrict(p.getDistrict());
        r.setState(p.getState());
        r.setPinCode(p.getPinCode());
        r.setIllness(p.getIllness());
        r.setReferredBy(p.getReferredBy());
        r.setReferrerId(p.getReferrerId());
        r.setDoctorName(p.getDoctorName());
        r.setDoctorId(p.getDoctorId());
        r.setDepartment(p.getDepartment());
        r.setPatientType(p.getPatientType());
        r.setInsuranceCompany(p.getInsuranceCompany());
        r.setInsuranceCompanyId(p.getInsuranceCompanyId());
        r.setPolicyNo(p.getPolicyNo());
        r.setTpaName(p.getTpaName());
        r.setAttendantName(p.getAttendantName());
        r.setAttendantRelation(p.getAttendantRelation());
        r.setAttendantPhone(p.getAttendantPhone());
        r.setIdProofType(p.getIdProofType());
        r.setIdProofNo(p.getIdProofNo());
        r.setNotes(p.getNotes());
        r.setActive(p.isActive());
        r.setPostAdmitEdited(p.isPostAdmitEdited());
        r.setCreatedBy(p.getCreatedBy());
        r.setCreatedAt(p.getCreatedAt());
        r.setUpdatedAt(p.getUpdatedAt());
        return r;
    }
}
