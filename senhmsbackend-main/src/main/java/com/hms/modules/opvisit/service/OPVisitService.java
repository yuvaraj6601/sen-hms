package com.hms.modules.opvisit.service;

import com.hms.common.AuditLogService;
import com.hms.exception.ResourceNotFoundException;
import com.hms.masters.enums.Gender;
import com.hms.modules.opvisit.dto.*;
import com.hms.modules.opvisit.entity.OPVisit;
import com.hms.modules.opvisit.enums.OPVisitStatus;
import com.hms.modules.opvisit.enums.RegistrationSource;
import com.hms.modules.opvisit.repository.OPVisitRepository;
import com.hms.modules.patient.dto.PatientRequest;
import com.hms.modules.patient.dto.PatientResponse;
import com.hms.modules.patient.repository.PatientRepository;
import com.hms.modules.patient.service.PatientService;
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
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class OPVisitService {

    private final OPVisitRepository repo;
    private final PatientService patientService;
    private final PatientRepository patientRepository;
    private final com.hms.modules.admission.repository.AdmissionRepository admissionRepository;
    private final AuditLogService auditLogService;

    // ── Queue for a specific date ─────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<OPVisitResponse> getQueue(LocalDate date, String search,
                                          String doctorId, OPVisitStatus status) {
        log.debug("[OPVISIT] getQueue date={} doctor={} status={}", date, doctorId, status);
        return repo.findQueueForDate(
                date,
                StringUtils.hasText(search)   ? search   : null,
                StringUtils.hasText(doctorId) ? doctorId : null,
                status
        ).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public QueueStatsResponse getStats(LocalDate date) {
        return new QueueStatsResponse(
                repo.countByVisitDate(date),
                repo.countByVisitDateAndStatus(date, OPVisitStatus.WAITING),
                repo.countByVisitDateAndStatus(date, OPVisitStatus.IN_CONSULTATION),
                repo.countByVisitDateAndStatus(date, OPVisitStatus.CONSULTATION_DONE),
                repo.countByVisitDateAndStatus(date, OPVisitStatus.BILLED),
                repo.countByVisitDateAndStatus(date, OPVisitStatus.PAID)
        );
    }

    // ── Paginated search across dates ─────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<OPVisitResponse> search(String search, String doctorId,
                                        OPVisitStatus status,
                                        LocalDate dateFrom, LocalDate dateTo,
                                        Pageable pageable) {
        return repo.search(
                StringUtils.hasText(search)   ? search   : null,
                StringUtils.hasText(doctorId) ? doctorId : null,
                status, dateFrom, dateTo, pageable
        ).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public OPVisitResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    @Transactional(readOnly = true)
    public List<OPVisitResponse> getPatientHistory(String uhid) {
        return repo.findByUhidOrderByVisitDateDesc(uhid)
                .stream().map(this::toResponse).toList();
    }

    // ── Distinct area / district suggestions ──────────────────────────────────

    @Transactional(readOnly = true)
    public List<String> getDistinctAreas() {
        return repo.findDistinctAreas();
    }

    @Transactional(readOnly = true)
    public List<String> getDistinctDistricts() {
        return repo.findDistinctDistricts();
    }

    // ── Create (assign token automatically) ──────────────────────────────────

    public OPVisitResponse create(OPVisitRequest req) {
        log.info("[OPVISIT] create patient='{}' doctor='{}' date={} source={}",
                req.getPatientName(), req.getDoctorName(), req.getVisitDate(), req.getRegistrationSource());

        // ── Auto-register walk-in patients ────────────────────────────────────
        // If no patientId is provided the patient is a walk-in who hasn't been
        // registered yet. Create a Patient record so they appear in the patient
        // list and can be billed, looked up in lab/insurance, etc.
        String resolvedPatientId = req.getPatientId();
        String resolvedUhid      = req.getUhid();

        boolean isWalkIn = !StringUtils.hasText(resolvedPatientId)
                || (StringUtils.hasText(resolvedUhid) && resolvedUhid.startsWith("WALK-"));

        if (isWalkIn) {
            // ── Duplicate phone check ─────────────────────────────────────────
            // Before creating a new Patient, check whether the phone number
            // already belongs to an existing patient.
            //
            //   VS (QR self-register): reuse the existing patient silently —
            //     the patient is known to the hospital; just add a new OP visit.
            //
            //   ML (staff "New Patient" form): block creation and return a 409
            //     so the receptionist can search for the existing patient and
            //     link the visit manually via "Existing Patient".
            String incomingPhone = StringUtils.hasText(req.getPhone()) ? req.getPhone().trim() : null;
            boolean isQrSelfReg  = req.getRegistrationSource() == RegistrationSource.VS;

            if (incomingPhone != null && !incomingPhone.equals("0000000000")) {
                com.hms.modules.patient.entity.Patient existingByPhone =
                        patientRepository.findFirstByPhoneOrderByIdAsc(incomingPhone).orElse(null);

                if (existingByPhone != null) {
                    if (isQrSelfReg) {
                        // Reuse the existing patient record — no new Patient created.
                        log.info("[OPVISIT] QR self-register: phone {} matches existing patient '{}' ({}). Reusing.",
                                incomingPhone, existingByPhone.getName(), existingByPhone.getUhid());
                        resolvedPatientId = String.valueOf(existingByPhone.getId());
                        resolvedUhid      = existingByPhone.getUhid();
                        isWalkIn          = false; // skip Patient creation below
                    } else {
                        // Staff new-patient form — block and surface the name.
                        throw new com.hms.exception.DuplicateResourceException(
                                "PATIENT_EXISTS:" + existingByPhone.getName()
                                        + " (" + existingByPhone.getUhid() + ")");
                    }
                }
            }

            if (isWalkIn) {
                // No existing patient found — create a new one.
                PatientRequest patReq = new PatientRequest();
                patReq.setName(req.getPatientName());
                // Use DOB if provided; otherwise fall back to the supplied age
                if (req.getDob() != null) {
                    patReq.setDateOfBirth(req.getDob());
                    patReq.setAge(calculateAge(req.getDob()));
                } else {
                    patReq.setAge(req.getAge());
                }
                // Map gender string to enum safely
                if (StringUtils.hasText(req.getGender())) {
                    try {
                        patReq.setGender(Gender.valueOf(req.getGender().toUpperCase()));
                    } catch (IllegalArgumentException ignored) {
                        patReq.setGender(Gender.MALE);
                    }
                } else {
                    patReq.setGender(Gender.MALE);
                }
                patReq.setPhone(incomingPhone != null ? incomingPhone : "0000000000");
                if (StringUtils.hasText(req.getAddress())) {
                    patReq.setAddress(req.getAddress());
                }
                patReq.setDoctorName(req.getDoctorName());
                patReq.setDepartment(req.getDepartment());
                patReq.setIllness(req.getChiefComplaint());

                PatientResponse saved = patientService.create(patReq);
                resolvedPatientId = String.valueOf(saved.getId());
                resolvedUhid      = saved.getUhid();
            }
        }

        // ── Guard: no OP token for a currently-admitted patient ───────────────
        // An in-patient is under the admitting team in the ward; issuing an OP
        // consultation token for them would double-count the patient as both IP
        // and OP and create a stray consultation charge. Cross-consultations for
        // admitted patients belong on the admission, not the OP queue. This
        // single check covers every entry point — direct create, appointment
        // "issue OP token", and QR self-registration all funnel through here.
        // (Freshly created walk-ins can't be admitted yet, so this only trips
        // for an existing patient id that resolves to an active admission.)
        if (StringUtils.hasText(resolvedPatientId)) {
            try {
                Long patId = Long.parseLong(resolvedPatientId);
                admissionRepository.findActiveByPatientId(patId).ifPresent(adm -> {
                    throw new IllegalStateException(
                            "Patient is currently admitted (" + adm.getAdmissionNo() + "). "
                                    + "An OP token cannot be issued for an in-patient. "
                                    + "Discharge the patient first, or handle this as an in-patient "
                                    + "cross-consultation on the admission.");
                });
            } catch (NumberFormatException ignored) {
                // Non-numeric patient id (e.g. legacy walk-in token) — no admission link to check.
            }
        }

        // Compute age from DOB at visit time (accurate even for returning patients)
        // Priority: (1) DOB sent in request, (2) DOB stored on existing patient record, (3) age as-is
        Integer visitAge = req.getAge();
        if (req.getDob() != null) {
            // Walk-in with DOB entered manually
            visitAge = calculateAge(req.getDob());
        } else if (StringUtils.hasText(resolvedPatientId)) {
            // Existing registered patient — look up their stored DOB and recalculate
            try {
                Long patId = Long.parseLong(resolvedPatientId);
                LocalDate storedDob = patientRepository.findById(patId)
                        .map(com.hms.modules.patient.entity.Patient::getDateOfBirth)
                        .orElse(null);
                if (storedDob != null) {
                    visitAge = calculateAge(storedDob);
                }
            } catch (NumberFormatException ignored) {
                // patientId is not a numeric Long — leave visitAge as-is
            }
        }

        // Resolve the address for the slip: prefer the request, else pull the
        // stored patient's address (composed of address / area / district).
        String resolvedAddress = req.getAddress();
        if (!StringUtils.hasText(resolvedAddress) && StringUtils.hasText(resolvedPatientId)) {
            try {
                Long patId = Long.parseLong(resolvedPatientId);
                resolvedAddress = patientRepository.findById(patId)
                        .map(p -> {
                            String composed = java.util.stream.Stream.of(
                                            p.getAddress(), p.getArea(), p.getDistrict())
                                    .filter(StringUtils::hasText)
                                    .reduce((a, b) -> a + ", " + b)
                                    .orElse(null);
                            return composed;
                        })
                        .orElse(null);
            } catch (NumberFormatException ignored) {
                // patientId is not numeric — leave address null
            }
        }

        com.hms.modules.opvisit.enums.RegType regType =
                req.getRegType() != null ? req.getRegType() : com.hms.modules.opvisit.enums.RegType.CONSULTATION;
        String tokenNo = generateToken(req.getVisitDate(), regType);
        String visitNo = generateVisitNo(req.getVisitDate());

        OPVisit visit = OPVisit.builder()
                .visitNo(visitNo)
                .tokenNo(tokenNo)
                .patientId(resolvedPatientId)
                .uhid(resolvedUhid)
                .patientName(req.getPatientName())
                .age(visitAge)
                .gender(req.getGender())
                .phone(req.getPhone())
                .address(resolvedAddress)
                .address1(req.getAddress1())
                .address2(req.getAddress2())
                .area(req.getArea())
                .district(req.getDistrict())
                .pincode(req.getPincode())
                .state(req.getState())
                .maritalStatus(req.getMaritalStatus())
                .religion(req.getReligion())
                .bloodGroup(req.getBloodGroup())
                .email(req.getEmail())
                .aadhaarNo(req.getAadhaarNo())
                .paymentType(req.getPaymentType())
                .companyTpa(req.getCompanyTpa())
                .doctorId(req.getDoctorId())
                .doctorName(req.getDoctorName())
                .department(req.getDepartment())
                .visitDate(req.getVisitDate())
                .visitTime(req.getVisitTime())
                .type(req.getType() != null ? req.getType() : com.hms.modules.opvisit.enums.OPVisitType.NEW)
                .regType(regType)
                .status(OPVisitStatus.WAITING)
                .chiefComplaint(req.getChiefComplaint())
                .consultationAmount(req.getConsultationAmount())
                .discountAmount(req.getDiscountAmount())
                .paidAmount(req.getPaidAmount())
                .paymentSplitsJson(req.getPaymentSplitsJson())
                .free(deriveFree(req.isFree(), req.getConsultationAmount(), req.getDiscountAmount()))
                .referredBy(req.getReferredBy())
                .registrationSource(req.getRegistrationSource() != null
                        ? req.getRegistrationSource() : RegistrationSource.ML)
                .build();

        OPVisit saved = repo.save(visit);
        log.info("[OPVISIT] Created visitNo={} tokenNo={} patient='{}' doctor='{}'",
                saved.getVisitNo(), saved.getTokenNo(), saved.getPatientName(), saved.getDoctorName());
        auditLogService.log("OPVisit", saved.getId(), "CREATE", currentUser(),
                "visitNo=" + saved.getVisitNo() + " token=" + saved.getTokenNo()
                        + " patient=" + saved.getPatientName() + " doctor=" + saved.getDoctorName());

        // Back-fill the patient master with any demographics captured on this
        // token that were previously blank on the record (fill-if-blank only —
        // never overwrite existing data). Lets staff enrich a patient (e.g. add
        // an address not collected at first registration) without a separate edit.
        backfillPatientDemographics(resolvedPatientId, req);

        return toResponse(saved);
    }

    /**
     * Fill-if-blank enrichment of the patient master from an OP token request.
     * Only applies to an already-registered (numeric id) patient and only sets
     * fields that are currently empty on the record; non-blank stored values are
     * left untouched so a token-desk entry can never clobber good master data.
     */
    private void backfillPatientDemographics(String patientId, OPVisitRequest req) {
        if (!StringUtils.hasText(patientId)) return;
        final Long patId;
        try {
            patId = Long.parseLong(patientId);
        } catch (NumberFormatException e) {
            return; // walk-in placeholder id — nothing to enrich
        }
        patientRepository.findById(patId).ifPresent(p -> {
            boolean changed = false;

            if (!StringUtils.hasText(p.getAddress()) && StringUtils.hasText(req.getAddress1())) {
                p.setAddress(req.getAddress1().trim()); changed = true;
            }
            if (!StringUtils.hasText(p.getArea()) && StringUtils.hasText(req.getArea())) {
                p.setArea(req.getArea().trim()); changed = true;
            }
            if (!StringUtils.hasText(p.getDistrict()) && StringUtils.hasText(req.getDistrict())) {
                p.setDistrict(req.getDistrict().trim()); changed = true;
            }
            if (!StringUtils.hasText(p.getState()) && StringUtils.hasText(req.getState())) {
                p.setState(req.getState().trim()); changed = true;
            }
            if (!StringUtils.hasText(p.getPinCode()) && StringUtils.hasText(req.getPincode())) {
                p.setPinCode(req.getPincode().trim()); changed = true;
            }
            if (!StringUtils.hasText(p.getEmail()) && StringUtils.hasText(req.getEmail())) {
                p.setEmail(req.getEmail().trim()); changed = true;
            }
            if (!StringUtils.hasText(p.getReligion()) && StringUtils.hasText(req.getReligion())) {
                p.setReligion(req.getReligion().trim()); changed = true;
            }
            if (p.getBloodGroup() == null) {
                var bg = parseBloodGroup(req.getBloodGroup());
                if (bg != null) { p.setBloodGroup(bg); changed = true; }
            }
            if (p.getMaritalStatus() == null) {
                var ms = parseMaritalStatus(req.getMaritalStatus());
                if (ms != null) { p.setMaritalStatus(ms); changed = true; }
            }

            if (changed) {
                patientRepository.save(p);
                log.info("[OPVISIT] Back-filled patient id={} demographics from OP token", patId);
            }
        });
    }

    /** Map an OP-form blood-group display string ("A+") to the patient enum. Null-safe. */
    private com.hms.modules.patient.enums.BloodGroup parseBloodGroup(String display) {
        if (!StringUtils.hasText(display)) return null;
        return switch (display.trim().toUpperCase()) {
            case "A+"  -> com.hms.modules.patient.enums.BloodGroup.A_POSITIVE;
            case "A-"  -> com.hms.modules.patient.enums.BloodGroup.A_NEGATIVE;
            case "B+"  -> com.hms.modules.patient.enums.BloodGroup.B_POSITIVE;
            case "B-"  -> com.hms.modules.patient.enums.BloodGroup.B_NEGATIVE;
            case "AB+" -> com.hms.modules.patient.enums.BloodGroup.AB_POSITIVE;
            case "AB-" -> com.hms.modules.patient.enums.BloodGroup.AB_NEGATIVE;
            case "O+"  -> com.hms.modules.patient.enums.BloodGroup.O_POSITIVE;
            case "O-"  -> com.hms.modules.patient.enums.BloodGroup.O_NEGATIVE;
            default     -> null;
        };
    }

    /** Map an OP-form marital-status display string ("Single") to the patient enum. Null-safe. */
    private com.hms.modules.patient.enums.MaritalStatus parseMaritalStatus(String display) {
        if (!StringUtils.hasText(display)) return null;
        return switch (display.trim().toUpperCase()) {
            case "SINGLE"    -> com.hms.modules.patient.enums.MaritalStatus.SINGLE;
            case "MARRIED"   -> com.hms.modules.patient.enums.MaritalStatus.MARRIED;
            case "WIDOWED"   -> com.hms.modules.patient.enums.MaritalStatus.WIDOWED;
            case "DIVORCED"  -> com.hms.modules.patient.enums.MaritalStatus.DIVORCED;
            case "SEPARATED" -> com.hms.modules.patient.enums.MaritalStatus.SEPARATED;
            case "OTHER"     -> com.hms.modules.patient.enums.MaritalStatus.OTHER;
            default           -> null;
        };
    }

    // ── QR Self-registration (public — no JWT) ────────────────────────────────

    public OPVisitResponse selfRegister(SelfRegisterRequest req) {
        OPVisitRequest visitReq = new OPVisitRequest();
        visitReq.setUhid("WALK-" + System.currentTimeMillis());
        visitReq.setPatientName(req.getName());
        visitReq.setPhone(req.getMobile());
        visitReq.setGender(req.getGender());
        visitReq.setAddress(req.getAddress());
        visitReq.setChiefComplaint(req.getIllness());
        visitReq.setVisitDate(LocalDate.now());
        visitReq.setVisitTime(
                java.time.LocalTime.now()
                        .format(java.time.format.DateTimeFormatter.ofPattern("HH:mm")));
        visitReq.setType(mapVisitType(req.getVisitType()));
        visitReq.setRegType(mapRegType(req.getRegType()));

        if (req.getDob() != null && !req.getDob().isBlank()) {
            try {
                LocalDate dob = LocalDate.parse(req.getDob());
                visitReq.setDob(dob);
                visitReq.setAge(calculateAge(dob));
            } catch (Exception ignored) {
                visitReq.setAge(req.getAge() != null ? req.getAge() : 0);
            }
        } else {
            visitReq.setAge(req.getAge() != null ? req.getAge() : 0);
        }

        String doctorId   = StringUtils.hasText(req.getDoctorId())   ? req.getDoctorId()   : "GENERAL";
        String doctorName = StringUtils.hasText(req.getDoctorName()) ? req.getDoctorName() : "General OPD";
        visitReq.setDoctorId(doctorId);
        visitReq.setDoctorName(doctorName);
        visitReq.setRegistrationSource(RegistrationSource.VS);
        return create(visitReq);
    }

    private com.hms.modules.opvisit.enums.RegType mapRegType(String raw) {
        if (raw == null) return com.hms.modules.opvisit.enums.RegType.CONSULTATION;
        return switch (raw.trim().toUpperCase()) {
            case "XRAY", "X-RAY"       -> com.hms.modules.opvisit.enums.RegType.XRAY;
            case "SCAN"                -> com.hms.modules.opvisit.enums.RegType.SCAN;
            case "REVIEW"              -> com.hms.modules.opvisit.enums.RegType.REVIEW;
            case "PHYSIOTHERAPY"       -> com.hms.modules.opvisit.enums.RegType.PHYSIOTHERAPY;
            case "OTHERS", "OTHER"     -> com.hms.modules.opvisit.enums.RegType.OTHERS;
            default                    -> com.hms.modules.opvisit.enums.RegType.CONSULTATION;
        };
    }

    private com.hms.modules.opvisit.enums.OPVisitType mapVisitType(String raw) {
        if (raw == null) return com.hms.modules.opvisit.enums.OPVisitType.NEW;
        return switch (raw.toUpperCase()) {
            case "REVIEW"                        -> com.hms.modules.opvisit.enums.OPVisitType.REVIEW;
            case "FOLLOW_UP", "FOLLOW-UP", "FOLLOW UP"
                                                 -> com.hms.modules.opvisit.enums.OPVisitType.FOLLOW_UP;
            default                              -> com.hms.modules.opvisit.enums.OPVisitType.NEW;
        };
    }

    // ── Advance status ────────────────────────────────────────────────────────

    public OPVisitResponse updateStatus(Long id, OPVisitStatusRequest req) {
        log.info("[OPVISIT] updateStatus id={} newStatus={}", id, req.getStatus());
        OPVisit visit = findOrThrow(id);
        OPVisitStatus old = visit.getStatus();
        OPVisitStatus next = req.getStatus();

        // ── Transition validation ─────────────────────────────────────────────
        // Only forward transitions are allowed (ordinal must increase)
        if (next.ordinal() <= old.ordinal()) {
            throw new IllegalArgumentException(
                "Invalid status transition: cannot move from " + old + " to " + next);
        }
        // CONSULTATION_DONE → BILLED requires a billId to be supplied
        if (next == OPVisitStatus.BILLED && (req.getBillId() == null || req.getBillId().isBlank())) {
            throw new IllegalArgumentException(
                "A bill must be created before marking the visit as BILLED. Please craft a bill first.");
        }
        // BILLED → PAID requires a billId to already be linked on the visit
        if (next == OPVisitStatus.PAID) {
            String existingBillId = req.getBillId() != null ? req.getBillId() : visit.getBillId();
            if (existingBillId == null || existingBillId.isBlank()) {
                throw new IllegalArgumentException(
                    "Cannot mark visit as PAID — no linked bill found. Please create and pay the bill first.");
            }
        }

        visit.setStatus(next);
        if (req.getBillId() != null && !req.getBillId().isBlank()) {
            visit.setBillId(req.getBillId());
        }
        OPVisit saved = repo.save(visit);
        auditLogService.log("OPVisit", id, "STATUS_UPDATE", currentUser(),
                "visitNo=" + saved.getVisitNo() + " from=" + old + " to=" + next);
        return toResponse(saved);
    }

    // ── Edit token payment (discount / amount / split) ────────────────────────
    // Used when a doctor marks the consultation free or the receptionist adjusts
    // the collected amount after the OP slip was generated. Recomputes the free
    // flag: a visit is "free" when the discount wipes out the whole consultation.

    public OPVisitResponse edit(Long id, OPVisitEditRequest req) {
        log.info("[OPVISIT] edit id={} consult={} discount={} paid={}",
                id, req.getConsultationAmount(), req.getDiscountAmount(), req.getPaidAmount());
        OPVisit visit = findOrThrow(id);

        if (req.getConsultationAmount() != null) visit.setConsultationAmount(req.getConsultationAmount());
        if (req.getDiscountAmount()     != null) visit.setDiscountAmount(req.getDiscountAmount());
        if (req.getPaidAmount()         != null) visit.setPaidAmount(req.getPaidAmount());
        if (req.getPaymentSplitsJson()  != null) visit.setPaymentSplitsJson(req.getPaymentSplitsJson());
        if (StringUtils.hasText(req.getPaymentType())) visit.setPaymentType(req.getPaymentType());

        visit.setFree(deriveFree(visit.isFree(),
                visit.getConsultationAmount(), visit.getDiscountAmount()));

        OPVisit saved = repo.save(visit);
        auditLogService.log("OPVisit", id, "EDIT_PAYMENT", currentUser(),
                "visitNo=" + saved.getVisitNo() + " paid=" + saved.getPaidAmount()
                        + " discount=" + saved.getDiscountAmount() + " free=" + saved.isFree());
        return toResponse(saved);
    }

    /**
     * A visit is free when a positive discount covers the full consultation
     * amount (discount ≥ consultation). The explicit free flag from the request
     * is honoured as an override.
     */
    private boolean deriveFree(boolean requestedFree,
                               java.math.BigDecimal consultation,
                               java.math.BigDecimal discount) {
        if (requestedFree) return true;
        if (consultation == null || discount == null) return false;
        if (consultation.signum() <= 0) return false;
        return discount.compareTo(consultation) >= 0;
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return "system";
        }
        return auth.getPrincipal().toString();
    }

    /**
     * Builds a per-regType daily token, e.g. CON290926001 for a Consultation
     * registered on 29-09-2026. The sequence restarts at 001 for each regType
     //on each date.
     */
    private String generateToken(LocalDate date, com.hms.modules.opvisit.enums.RegType regType) {
        String prefix = regType.getTokenPrefix();
        String datePart = date.format(
                java.time.format.DateTimeFormatter.ofPattern("ddMMyy"));
        // New format: CON-300926-001 — LIKE pattern matches the prefix+date portion
        String tokenPrefixLike = prefix + "-" + datePart + "-%";
        int next = repo.findMaxTokenSeqForDateAndPrefix(date, tokenPrefixLike) + 1;
        return String.format("%s-%s-%03d", prefix, datePart, next);
    }

    private String generateVisitNo(LocalDate date) {
        int year = date.getYear();
        int seq  = (repo.findMaxSeqForYear(year) == null
                ? 0 : repo.findMaxSeqForYear(year)) + 1;
        return String.format("OPV-%d-%05d", year, seq);
    }

    private int calculateAge(LocalDate dob) {
        LocalDate today = LocalDate.now();
        int age = today.getYear() - dob.getYear();
        if (today.getMonthValue() < dob.getMonthValue() ||
            (today.getMonthValue() == dob.getMonthValue() && today.getDayOfMonth() < dob.getDayOfMonth())) {
            age--;
        }
        return Math.max(0, age);
    }

    private OPVisit findOrThrow(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("OPVisit", id));
    }

    private OPVisitResponse toResponse(OPVisit v) {
        OPVisitResponse r = new OPVisitResponse();
        r.setId(v.getId());
        r.setVisitNo(v.getVisitNo());
        r.setTokenNo(v.getTokenNo());
        r.setPatientId(v.getPatientId());
        r.setUhid(v.getUhid());
        r.setPatientName(v.getPatientName());
        r.setAge(v.getAge());
        r.setGender(v.getGender());
        r.setPhone(v.getPhone());
        r.setAddress(v.getAddress());
        r.setAddress1(v.getAddress1());
        r.setAddress2(v.getAddress2());
        r.setArea(v.getArea());
        r.setDistrict(v.getDistrict());
        r.setPincode(v.getPincode());
        r.setState(v.getState());
        r.setMaritalStatus(v.getMaritalStatus());
        r.setReligion(v.getReligion());
        r.setBloodGroup(v.getBloodGroup());
        r.setEmail(v.getEmail());
        r.setAadhaarNo(v.getAadhaarNo());
        r.setPaymentType(v.getPaymentType());
        r.setCompanyTpa(v.getCompanyTpa());
        r.setDoctorId(v.getDoctorId());
        r.setDoctorName(v.getDoctorName());
        r.setDepartment(v.getDepartment());
        r.setVisitDate(v.getVisitDate());
        r.setVisitTime(v.getVisitTime());
        r.setType(v.getType());
        r.setRegType(v.getRegType());
        r.setStatus(v.getStatus());
        r.setChiefComplaint(v.getChiefComplaint());
        r.setBillId(v.getBillId());
        r.setFree(v.isFree());
        r.setConsultationAmount(v.getConsultationAmount());
        r.setDiscountAmount(v.getDiscountAmount());
        r.setPaidAmount(v.getPaidAmount());
        r.setPaymentSplitsJson(v.getPaymentSplitsJson());
        r.setReferredBy(v.getReferredBy());
        r.setRegistrationSource(v.getRegistrationSource());
        r.setCreatedBy(v.getCreatedBy());
        r.setCreatedAt(v.getCreatedAt());
        r.setUpdatedAt(v.getUpdatedAt());
        return r;
    }
}
