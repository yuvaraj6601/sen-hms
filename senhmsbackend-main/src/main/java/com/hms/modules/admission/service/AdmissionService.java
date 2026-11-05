package com.hms.modules.admission.service;

import com.hms.common.AuditLogService;
import com.hms.exception.DuplicateResourceException;
import com.hms.exception.ResourceNotFoundException;
import com.hms.masters.entity.Bed;
import com.hms.masters.entity.Ward;
import com.hms.masters.repository.BedRepository;
import com.hms.masters.repository.WardRepository;
import com.hms.modules.admission.dto.*;
import com.hms.modules.admission.entity.Admission;
import com.hms.modules.admission.entity.TransferLog;
import com.hms.modules.admission.enums.AdmissionStatus;
import com.hms.modules.admission.enums.InsuranceWorkflowStatus;
import com.hms.modules.admission.enums.TransferType;
import com.hms.modules.admission.repository.AdmissionRepository;
import com.hms.modules.admission.repository.TransferLogRepository;
import com.hms.modules.billing.entity.Bill;
import com.hms.modules.billing.enums.BillStatus;
import com.hms.modules.billing.repository.BillRepository;
import com.hms.modules.casesheet.enums.MedicationStatus;
import com.hms.modules.casesheet.repository.MedicationRepository;
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

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class AdmissionService {

    private final AuditLogService auditLogService;
    private final AdmissionRepository admissionRepo;
    private final TransferLogRepository transferRepo;
    private final PatientRepository patientRepo;
    private final BedRepository bedRepo;
    private final WardRepository wardRepo;
    private final BillRepository billRepo;
    private final MedicationRepository medicationRepo;

    // ── Admit patient ─────────────────────────────────────────────────────────

    public AdmissionResponse admit(AdmissionRequest req) {
        log.info("[ADMISSION] admit() called for patientId={} bed={} ward={}",
                req.getPatientId(), req.getBedId(), req.getWardId());

        Patient patient = patientRepo.findById(req.getPatientId())
                .orElseThrow(() -> new ResourceNotFoundException("Patient", req.getPatientId()));

        // Guard: patient should not already be actively admitted
        admissionRepo.findActiveByPatientId(req.getPatientId()).ifPresent(a -> {
            throw new DuplicateResourceException(
                    "Patient already has an active admission: " + a.getAdmissionNo());
        });

        // Guard: block re-admission if patient has any unpaid bills.
        // Skip this check when THIS admission is being marked free (per-admission).
        if (!req.isFree()) {
            BigDecimal totalDue = billRepo.findByPatientIdOrderByDateDesc(req.getPatientId())
                    .stream()
                    .filter(b -> b.getStatus() == BillStatus.PENDING || b.getStatus() == BillStatus.PARTIAL)
                    .filter(b -> b.getDueAmount() != null && b.getDueAmount().compareTo(BigDecimal.ZERO) > 0)
                    .map(com.hms.modules.billing.entity.Bill::getDueAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            if (totalDue.compareTo(BigDecimal.ZERO) > 0) {
                throw new DuplicateResourceException(
                        "Cannot admit patient: outstanding balance of ₹" + totalDue
                        + ". Please clear all dues before re-admitting.");
            }
        }

        // Validate and reserve bed
        Bed bed = bedRepo.findById(req.getBedId())
                .orElseThrow(() -> new ResourceNotFoundException("Bed", req.getBedId()));
        if (bed.getStatus() != Bed.BedStatus.AVAILABLE) {
            throw new DuplicateResourceException(
                    "Bed " + bed.getNumber() + " is not available (status: " + bed.getStatus() + ")");
        }

        Ward ward = wardRepo.findById(req.getWardId())
                .orElseThrow(() -> new ResourceNotFoundException("Ward", req.getWardId()));

        String admissionNo = generateAdmissionNo(req.getAdmissionDate());

        Admission admission = Admission.builder()
                .admissionNo(admissionNo)
                .patientId(patient.getId())
                .uhid(patient.getUhid())
                .patientName(patient.getName())
                .age(patient.getAge())
                .gender(patient.getGender() != null ? patient.getGender().name() : null)
                .phone(patient.getPhone())
                .admissionType(req.getAdmissionType())
                .admissionDate(req.getAdmissionDate())
                .admissionTime(req.getAdmissionTime())
                .provisionalDiagnosis(req.getProvisionalDiagnosis())
                .conditionOnAdmission(req.getConditionOnAdmission())
                .admittingDoctorId(req.getAdmittingDoctorId())
                .admittingDoctorName(req.getAdmittingDoctorName())
                .department(req.getDepartment())
                .wardId(ward.getId())
                .wardName(ward.getName())
                .bedId(bed.getId())
                .bedNumber(bed.getNumber())
                .referredBy(req.getReferredBy())
                .referrerId(req.getReferrerId())
                .attendantName(req.getAttendantName())
                .attendantRelation(req.getAttendantRelation())
                .attendantPhone(req.getAttendantPhone())
                .paymentMode(req.getPaymentMode())
                .isInsurance(req.isInsurance())
                .insuranceStatus(resolveInsuranceStatus(req.isInsurance(), req.getInsuranceStatus()))
                .insuranceCompany(req.getInsuranceCompany())
                .insuranceCompanyId(req.getInsuranceCompanyId())
                .policyNo(req.getPolicyNo())
                .tpaName(req.getTpaName())
                .claimNo(req.getClaimNo())
                .preAuthNumber(req.getPreAuthNumber())
                .insuredPersonName(req.getInsuredPersonName())
                .cardNumber(req.getCardNumber())
                .insuranceClaimType(req.getInsuranceClaimType())
                .mlc(req.isMlc())
                .mlcNumber(req.getMlcNumber())
                .free(req.isFree())
                .surgical(req.isSurgical())
                .status(AdmissionStatus.ADMITTED)
                .notes(req.getNotes())
                .planOfCare(req.getPlanOfCare())
                .expectedCost(req.getExpectedCost())
                .expectedOutcome(req.getExpectedOutcome())
                .build();

        Admission saved = admissionRepo.save(admission);
        log.info("[ADMISSION] Admitted admissionNo={} patientId={} bed={} ward={}",
                saved.getAdmissionNo(), patient.getId(), bed.getNumber(), ward.getName());

        // Mark bed OCCUPIED
        bed.setStatus(Bed.BedStatus.OCCUPIED);
        bed.setPatientId(patient.getId());
        bed.setPatientName(patient.getName());
        bedRepo.save(bed);

        // Update ward occupancy
        ward.setOccupiedBeds(ward.getOccupiedBeds() + 1);
        wardRepo.save(ward);

        // Update patient type to IP
        patient.setPatientType(PatientType.IP);
        patientRepo.save(patient);

        auditLogService.log("Admission", saved.getId(), "ADMIT", currentUser(),
                "admissionNo=" + saved.getAdmissionNo() + " patient=" + patient.getName()
                        + " bed=" + bed.getNumber() + " ward=" + ward.getName());

        return toResponse(saved, List.of());
    }

    // ── Edit admission (non-clinical / non-bed fields) ────────────────────────
    /**
     * Update editable admission fields after admission.
     *
     * Edits: surgical, free, mlc/mlcNumber, admission type/date/time, diagnosis,
     * condition, doctor/department, referral, attendant, insurance/payment,
     * notes, and admission-order-slip fields.
     *
     * Does NOT change bed/ward (use transfer), status (use updateStatus) or
     * discharge fields (use discharge).
     */
    public AdmissionResponse updateAdmission(Long id, AdmissionEditRequest req) {
        log.info("[ADMISSION] updateAdmission id={}", id);
        Admission a = findOrThrow(id);
        if (a.getStatus() == AdmissionStatus.DISCHARGED) {
            throw new DuplicateResourceException("Cannot edit a discharged admission");
        }

        // ── Payment-type lock ─────────────────────────────────────────────────
        // The payment type is frozen only once the MAIN IP bill has been raised —
        // i.e. an IPD counter bill, the final consolidated/summary bill (IP_FINAL),
        // or any consolidated bill. Flipping Cash<->Insurance after that would
        // orphan the insurance claim and corrupt the money trail.
        //
        // Lab, Pharmacy and OPD counter bills are explicitly ignored: they are
        // paid at the counter and auto-generated independently (a lab test raises
        // its own bill), so their presence must NOT block the coordinator from
        // later marking the admission as an insurance case. Those incidental
        // charges are what later get consolidated into the insurance claim.
        // Cancelled bills never count.
        if (req.isInsurance() != a.isInsurance()) {
            boolean hasMainIpBill = billRepo.findByAdmissionIdOrderByDateDesc(id).stream()
                    .filter(b -> b.getStatus() != BillStatus.CANCELLED)
                    .anyMatch(AdmissionService::isMainIpBill);
            if (hasMainIpBill) {
                throw new DuplicateResourceException(
                        "Payment type (Cash / Insurance) cannot be changed because the patient's "
                        + "IP bill has already been generated for this admission.");
            }
        }

        // Editable admission-level name snapshot (does NOT touch the Patient record).
        if (StringUtils.hasText(req.getPatientName())) a.setPatientName(req.getPatientName());
        a.setAdmissionType(req.getAdmissionType());
        if (req.getAdmissionDate() != null) a.setAdmissionDate(req.getAdmissionDate());
        a.setAdmissionTime(req.getAdmissionTime());
        a.setProvisionalDiagnosis(req.getProvisionalDiagnosis());
        a.setConditionOnAdmission(req.getConditionOnAdmission());
        a.setAdmittingDoctorId(req.getAdmittingDoctorId());
        if (StringUtils.hasText(req.getAdmittingDoctorName())) a.setAdmittingDoctorName(req.getAdmittingDoctorName());
        a.setDepartment(req.getDepartment());
        a.setReferredBy(req.getReferredBy());
        a.setReferrerId(req.getReferrerId());
        a.setAttendantName(req.getAttendantName());
        a.setAttendantRelation(req.getAttendantRelation());
        a.setAttendantPhone(req.getAttendantPhone());
        a.setPaymentMode(req.getPaymentMode());
        a.setInsurance(req.isInsurance());
        // If the case is insurance but no status yet, seed DETAILS_INCOMPLETE;
        // otherwise honour the status sent by the coordinator. Clear when not insurance.
        a.setInsuranceStatus(resolveInsuranceStatus(req.isInsurance(), req.getInsuranceStatus()));
        a.setInsuranceCompany(req.getInsuranceCompany());
        a.setInsuranceCompanyId(req.getInsuranceCompanyId());
        a.setPolicyNo(req.getPolicyNo());
        a.setTpaName(req.getTpaName());
        a.setClaimNo(req.getClaimNo());
        a.setPreAuthNumber(req.getPreAuthNumber());
        a.setInsuredPersonName(req.getInsuredPersonName());
        a.setCardNumber(req.getCardNumber());
        a.setInsuranceClaimType(req.getInsuranceClaimType());
        a.setMlc(req.isMlc());
        a.setMlcNumber(req.isMlc() ? req.getMlcNumber() : null);
        a.setFree(req.isFree());
        a.setSurgical(req.isSurgical());
        a.setNotes(req.getNotes());
        a.setPlanOfCare(req.getPlanOfCare());
        a.setExpectedCost(req.getExpectedCost());
        a.setExpectedOutcome(req.getExpectedOutcome());

        Admission saved = admissionRepo.save(a);
        auditLogService.log("Admission", id, "UPDATE", currentUser(),
                "admissionNo=" + saved.getAdmissionNo() + " free=" + saved.isFree() + " surgical=" + saved.isSurgical());
        return toResponse(saved,
                transferRepo.findByAdmissionIdOrderByTransferDateDescTransferTimeDesc(id));
    }

    // ── Search / list ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<AdmissionResponse> search(String search, AdmissionStatus status,
                                          Long admittingDoctorId, Long wardId,
                                          LocalDate dateFrom, LocalDate dateTo,
                                          Pageable pageable) {
        return admissionRepo.search(
                StringUtils.hasText(search) ? search : null,
                status, admittingDoctorId, wardId, dateFrom, dateTo, pageable
        ).map(a -> toResponse(a, transferRepo.findByAdmissionIdOrderByTransferDateDescTransferTimeDesc(a.getId())));
    }

    @Transactional(readOnly = true)
    public AdmissionResponse getById(Long id) {
        Admission a = findOrThrow(id);
        return toResponse(a, transferRepo.findByAdmissionIdOrderByTransferDateDescTransferTimeDesc(id));
    }

    @Transactional(readOnly = true)
    public AdmissionResponse getByAdmissionNo(String admissionNo) {
        Admission a = admissionRepo.findByAdmissionNo(admissionNo)
                .orElseThrow(() -> new ResourceNotFoundException("Admission " + admissionNo + " not found"));
        return toResponse(a, transferRepo.findByAdmissionIdOrderByTransferDateDescTransferTimeDesc(a.getId()));
    }

    @Transactional(readOnly = true)
    public List<AdmissionResponse> getByPatientId(Long patientId) {
        return admissionRepo.findByPatientIdOrderByAdmissionDateDesc(patientId)
                .stream()
                .map(a -> toResponse(a, transferRepo.findByAdmissionIdOrderByTransferDateDescTransferTimeDesc(a.getId())))
                .toList();
    }

    // ── Update status (condition updates) ─────────────────────────────────────

    public AdmissionResponse updateStatus(Long id, AdmissionStatusRequest req) {
        log.info("[ADMISSION] updateStatus id={} newStatus={}", id, req.getStatus());
        Admission a = findOrThrow(id);
        if (a.getStatus() == AdmissionStatus.DISCHARGED) {
            throw new DuplicateResourceException("Cannot update status of a discharged admission");
        }
        a.setStatus(req.getStatus());
        if (StringUtils.hasText(req.getNotes())) {
            a.setNotes(req.getNotes());
        }
        Admission saved = admissionRepo.save(a);
        auditLogService.log("Admission", id, "STATUS_UPDATE", currentUser(),
                "admissionNo=" + saved.getAdmissionNo() + " status=" + req.getStatus());
        return toResponse(saved,
                transferRepo.findByAdmissionIdOrderByTransferDateDescTransferTimeDesc(id));
    }

    // ── Transfer ──────────────────────────────────────────────────────────────

    public TransferLogResponse transfer(Long admissionId, TransferRequest req) {
        log.info("[ADMISSION] transfer admissionId={} type={} from='{}' to='{}'",
                admissionId, req.getTransferType(), req.getFromValue(), req.getToValue());
        Admission admission = findOrThrow(admissionId);
        if (admission.getStatus() == AdmissionStatus.DISCHARGED) {
            throw new DuplicateResourceException("Cannot transfer a discharged patient");
        }

        String transferNo = generateTransferNo(req.getTransferDate());

        TransferLog transferLog = TransferLog.builder()
                .transferNo(transferNo)
                .admissionId(admission.getId())
                .admissionNo(admission.getAdmissionNo())
                .patientId(admission.getPatientId())
                .uhid(admission.getUhid())
                .patientName(admission.getPatientName())
                .transferType(req.getTransferType())
                .fromValue(req.getFromValue())
                .toValue(req.getToValue())
                .toId(req.getToId())
                .transferDate(req.getTransferDate())
                .transferTime(req.getTransferTime())
                .reason(req.getReason())
                .orderedBy(req.getOrderedBy())
                .doneBy(req.getDoneBy())
                .notes(req.getNotes())
                .build();

        TransferLog saved = transferRepo.save(transferLog);

        // Apply the transfer to the admission record
        applyTransfer(admission, req);
        admissionRepo.save(admission);

        log.info("[ADMISSION] Transfer saved transferNo={} admissionNo={}",
                saved.getTransferNo(), admission.getAdmissionNo());
        auditLogService.log("Admission", admissionId, "TRANSFER", currentUser(),
                "transferNo=" + saved.getTransferNo()
                        + " type=" + req.getTransferType()
                        + " from=" + req.getFromValue()
                        + " to=" + req.getToValue());

        return toTransferResponse(saved);
    }

    // ── Initiate discharge ────────────────────────────────────────────────────

    public AdmissionResponse initiateDischarge(Long id) {
        log.info("[ADMISSION] initiateDischarge id={}", id);
        Admission a = findOrThrow(id);
        if (a.getStatus() == AdmissionStatus.DISCHARGED) {
            throw new DuplicateResourceException("Patient is already discharged");
        }
        a.setStatus(AdmissionStatus.DISCHARGE_INITIATED);
        a.setDischargeInitiatedAt(java.time.LocalDateTime.now());
        Admission saved = admissionRepo.save(a);
        auditLogService.log("Admission", id, "DISCHARGE_INITIATED", currentUser(),
                "admissionNo=" + saved.getAdmissionNo());
        return toResponse(saved,
                transferRepo.findByAdmissionIdOrderByTransferDateDescTransferTimeDesc(id));
    }

    // ── Discharge ─────────────────────────────────────────────────────────────

    public AdmissionResponse discharge(Long id, DischargeRequest req) {
        log.info("[ADMISSION] discharge id={} dischargeDate={}", id, req.getDischargeDate());
        Admission a = findOrThrow(id);
        if (a.getStatus() == AdmissionStatus.DISCHARGED) {
            throw new DuplicateResourceException("Patient is already discharged");
        }

        String dischargeNo = generateDischargeNo(req.getDischargeDate());

        // Calculate LOS
        long days = java.time.temporal.ChronoUnit.DAYS.between(a.getAdmissionDate(), req.getDischargeDate());

        a.setDischargeNo(dischargeNo);
        a.setDischargeType(req.getDischargeType());
        a.setDischargeDate(req.getDischargeDate());
        a.setDischargeTime(req.getDischargeTime());
        a.setDischargingDoctorName(req.getDischargingDoctorName());
        a.setFinalDiagnosis(req.getFinalDiagnosis());
        a.setProceduresPerformed(req.getProceduresPerformed());
        a.setConditionOnDischarge(req.getConditionOnDischarge());
        a.setFollowUpDate(req.getFollowUpDate());
        a.setReferredTo(req.getReferredTo());
        a.setTotalDaysStayed((int) days);
        a.setDischargeNotes(req.getDischargeNotes());
        a.setStatus(AdmissionStatus.DISCHARGED);

        // Auto-complete all active medications for this admission
        medicationRepo.findByAdmissionIdAndStatusOrderByDateDescTimeDesc(id, MedicationStatus.ACTIVE)
                .forEach(med -> {
                    med.setStatus(MedicationStatus.COMPLETED);
                    med.setStoppedOn(req.getDischargeDate());
                    med.setStoppedReason("Patient discharged"
                            + (req.getDischargeType() != null ? " — " + req.getDischargeType() : ""));
                    med.setStoppedBy(currentUser());
                });

        Admission saved = admissionRepo.save(a);

        // Free the bed
        if (a.getBedId() != null) {
            bedRepo.findById(a.getBedId()).ifPresent(bed -> {
                bed.setStatus(Bed.BedStatus.AVAILABLE);
                bed.setPatientId(null);
                bed.setPatientName(null);
                bedRepo.save(bed);

                wardRepo.findById(bed.getWard().getId()).ifPresent(ward -> {
                    ward.setOccupiedBeds(Math.max(0, ward.getOccupiedBeds() - 1));
                    wardRepo.save(ward);
                });
            });
        }

        // Update patient type back to BOTH (has OP + IP history)
        patientRepo.findById(a.getPatientId()).ifPresent(p -> {
            p.setPatientType(PatientType.BOTH);
            patientRepo.save(p);
        });

        log.info("[ADMISSION] Discharged admissionNo={} dischargeNo={} days={}",
                saved.getAdmissionNo(), saved.getDischargeNo(), saved.getTotalDaysStayed());
        auditLogService.log("Admission", id, "DISCHARGE", currentUser(),
                "admissionNo=" + saved.getAdmissionNo()
                        + " dischargeNo=" + saved.getDischargeNo()
                        + " days=" + saved.getTotalDaysStayed());

        return toResponse(saved,
                transferRepo.findByAdmissionIdOrderByTransferDateDescTransferTimeDesc(id));
    }

    // ── Transfer application logic ─────────────────────────────────────────────

    private void applyTransfer(Admission admission, TransferRequest req) {
        switch (req.getTransferType()) {
            case WARD -> {
                // Free old bed
                freeBed(admission.getBedId(), admission.getPatientId(), admission.getPatientName());
                admission.setWardId(req.getToId());
                admission.setWardName(req.getToValue());
                admission.setBedId(null);
                admission.setBedNumber(null);
            }
            case BED -> {
                // Free old bed, occupy new bed
                freeBed(admission.getBedId(), admission.getPatientId(), admission.getPatientName());
                if (req.getToId() != null) {
                    bedRepo.findById(req.getToId()).ifPresent(newBed -> {
                        newBed.setStatus(Bed.BedStatus.OCCUPIED);
                        newBed.setPatientId(admission.getPatientId());
                        newBed.setPatientName(admission.getPatientName());
                        bedRepo.save(newBed);
                        admission.setBedId(newBed.getId());
                        admission.setBedNumber(newBed.getNumber());
                        // Always update wardId/wardName to the new bed's ward
                        wardRepo.findById(newBed.getWard().getId()).ifPresent(w -> {
                            w.setOccupiedBeds(w.getOccupiedBeds() + 1);
                            wardRepo.save(w);
                            admission.setWardId(w.getId());
                            admission.setWardName(w.getName());
                        });
                    });
                }
            }
            case DEPARTMENT -> {
                admission.setDepartment(req.getToValue());
            }
            case DOCTOR -> {
                admission.setAdmittingDoctorName(req.getToValue());
                admission.setAdmittingDoctorId(req.getToId());
            }
            case CONDITION -> {
                // Condition tracked in status — caller should also call updateStatus
            }
            default -> { /* ROOM, PROCEDURE, DISCHARGE_TYPE — logged only */ }
        }
    }

    private void freeBed(Long bedId, Long patientId, String patientName) {
        if (bedId == null) return;
        bedRepo.findById(bedId).ifPresent(bed -> {
            // Only decrement if the bed is actually occupied (avoid double-decrement)
            boolean wasOccupied = bed.getStatus() == Bed.BedStatus.OCCUPIED;
            bed.setStatus(Bed.BedStatus.AVAILABLE);
            bed.setPatientId(null);
            bed.setPatientName(null);
            bedRepo.save(bed);
            if (wasOccupied) {
                wardRepo.findById(bed.getWard().getId()).ifPresent(w -> {
                    w.setOccupiedBeds(Math.max(0, w.getOccupiedBeds() - 1));
                    wardRepo.save(w);
                });
            }
        });
    }

    // ── Number generators ──────────────────────────────────────────────────────

    private String generateAdmissionNo(LocalDate date) {
        String prefix = date.format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        int seq = admissionRepo.findMaxAdmissionSeqForDate(prefix) + 1;
        return String.format("ADM-%s-%04d", prefix, seq);
    }

    private String generateDischargeNo(LocalDate date) {
        String prefix = date.format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        int seq = admissionRepo.findMaxDischargeSeqForDate(prefix) + 1;
        return String.format("DIS-%s-%04d", prefix, seq);
    }

    private String generateTransferNo(LocalDate date) {
        String prefix = date.format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        int seq = transferRepo.findMaxTransferSeqForDate(prefix) + 1;
        return String.format("TRF-%s-%04d", prefix, seq);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return "system";
        }
        return auth.getPrincipal().toString();
    }

    private Admission findOrThrow(Long id) {
        return admissionRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Admission", id));
    }

    /**
     * Resolve the insurance workflow status to persist.
     * <ul>
     *   <li>Not an insurance case → null (clears any prior status).</li>
     *   <li>Insurance case with an explicit status → use it.</li>
     *   <li>Insurance case with no status yet → seed DETAILS_INCOMPLETE.</li>
     * </ul>
     */
    private InsuranceWorkflowStatus resolveInsuranceStatus(boolean isInsurance,
                                                           InsuranceWorkflowStatus requested) {
        if (!isInsurance) return null;
        return requested != null ? requested : InsuranceWorkflowStatus.DETAILS_INCOMPLETE;
    }

    /**
     * A "main IP bill" is the patient-level inpatient bill that represents the
     * hospital's billing COMMITMENT for an admission — an IPD counter bill, the
     * final consolidated/summary document (IP_FINAL), or any consolidated bill.
     * Only these freeze the Cash/Insurance payment type.
     *
     * An EMPTY DRAFT (₹0 items) is EXCLUDED: the Collect Cash flow creates a
     * DRAFT (towards "IPD", ₹0 items) purely to hold advance receipts BEFORE any
     * bill is crafted. Collecting an advance must NOT freeze the payment type —
     * the coordinator can still switch Cash<->Insurance until real charges exist.
     *
     * A DRAFT that already carries real service charges (totalAmount > 0) DOES
     * freeze the payment type: once services have been billed in the craft modal,
     * the Cash/Insurance type is a commitment and must not be flipped in either
     * direction (cash->insurance or insurance->cash) from the admission screen.
     *
     * Lab / Pharmacy / OPD counter bills return false: they are incidental,
     * paid at the counter, and auto-generated per test/dispense, so they must
     * not block switching the admission to an insurance case later.
     */
    private static boolean isMainIpBill(Bill b) {
        if (b.isConsolidated()) return true;
        String towards = b.getTowards();
        if (towards == null) return false;
        String t = towards.trim();
        boolean isIpTowards = "IPD".equalsIgnoreCase(t) || "IP_FINAL".equalsIgnoreCase(t);
        if (!isIpTowards) return false;

        // A DRAFT IP bill locks the payment type only once it carries real
        // service charges. An empty (₹0) DRAFT is just an advance-receipt holder.
        if (b.getStatus() == BillStatus.DRAFT) {
            return b.getTotalAmount() != null
                    && b.getTotalAmount().compareTo(BigDecimal.ZERO) > 0;
        }
        return true;
    }

    private AdmissionResponse toResponse(Admission a, List<TransferLog> transfers) {
        AdmissionResponse r = new AdmissionResponse();
        r.setId(a.getId());
        r.setAdmissionNo(a.getAdmissionNo());
        r.setPatientId(a.getPatientId());
        r.setUhid(a.getUhid());
        r.setPatientName(a.getPatientName());
        r.setAge(a.getAge());
        r.setGender(a.getGender());
        r.setPhone(a.getPhone());
        r.setAdmissionType(a.getAdmissionType());
        r.setAdmissionDate(a.getAdmissionDate());
        r.setAdmissionTime(a.getAdmissionTime());
        r.setProvisionalDiagnosis(a.getProvisionalDiagnosis());
        r.setConditionOnAdmission(a.getConditionOnAdmission());
        r.setAdmittingDoctorId(a.getAdmittingDoctorId());
        r.setAdmittingDoctorName(a.getAdmittingDoctorName());
        r.setDepartment(a.getDepartment());
        r.setWardId(a.getWardId());
        r.setWardName(a.getWardName());
        r.setBedId(a.getBedId());
        r.setBedNumber(a.getBedNumber());
        r.setReferredBy(a.getReferredBy());
        r.setReferrerId(a.getReferrerId());
        r.setAttendantName(a.getAttendantName());
        r.setAttendantRelation(a.getAttendantRelation());
        r.setAttendantPhone(a.getAttendantPhone());
        r.setPaymentMode(a.getPaymentMode());
        r.setInsurance(a.isInsurance());
        r.setInsuranceStatus(a.getInsuranceStatus());
        r.setInsuranceCompany(a.getInsuranceCompany());
        r.setInsuranceCompanyId(a.getInsuranceCompanyId());
        r.setPolicyNo(a.getPolicyNo());
        r.setTpaName(a.getTpaName());
        r.setClaimNo(a.getClaimNo());
        r.setPreAuthNumber(a.getPreAuthNumber());
        r.setInsuredPersonName(a.getInsuredPersonName());
        r.setCardNumber(a.getCardNumber());
        r.setInsuranceClaimType(a.getInsuranceClaimType());
        r.setMlc(a.isMlc());
        r.setMlcNumber(a.getMlcNumber());
        r.setFree(a.isFree());
        r.setSurgical(a.isSurgical());
        r.setStatus(a.getStatus());
        r.setDischargeNo(a.getDischargeNo());
        r.setDischargeType(a.getDischargeType());
        r.setDischargeDate(a.getDischargeDate());
        r.setDischargeTime(a.getDischargeTime());
        r.setDischargingDoctorName(a.getDischargingDoctorName());
        r.setFinalDiagnosis(a.getFinalDiagnosis());
        r.setProceduresPerformed(a.getProceduresPerformed());
        r.setConditionOnDischarge(a.getConditionOnDischarge());
        r.setFollowUpDate(a.getFollowUpDate());
        r.setReferredTo(a.getReferredTo());
        r.setTotalDaysStayed(a.getTotalDaysStayed());
        r.setDischargeNotes(a.getDischargeNotes());
        r.setDischargeInitiatedAt(a.getDischargeInitiatedAt());
        r.setNotes(a.getNotes());
        r.setPlanOfCare(a.getPlanOfCare());
        r.setExpectedCost(a.getExpectedCost());
        r.setExpectedOutcome(a.getExpectedOutcome());
        r.setTransfers(transfers.stream().map(this::toTransferResponse).toList());
        r.setCreatedBy(a.getCreatedBy());
        r.setCreatedAt(a.getCreatedAt());
        r.setUpdatedAt(a.getUpdatedAt());

        // Compute days admitted so far
        if (a.getAdmissionDate() != null && a.getStatus() != AdmissionStatus.DISCHARGED) {
            r.setDaysAdmitted((int) java.time.temporal.ChronoUnit.DAYS.between(
                    a.getAdmissionDate(), LocalDate.now()));
        } else {
            r.setDaysAdmitted(a.getTotalDaysStayed());
        }
        return r;
    }

    public TransferLogResponse toTransferResponse(TransferLog t) {
        TransferLogResponse r = new TransferLogResponse();
        r.setId(t.getId());
        r.setTransferNo(t.getTransferNo());
        r.setAdmissionId(t.getAdmissionId());
        r.setAdmissionNo(t.getAdmissionNo());
        r.setPatientId(t.getPatientId());
        r.setUhid(t.getUhid());
        r.setPatientName(t.getPatientName());
        r.setTransferType(t.getTransferType());
        r.setFromValue(t.getFromValue());
        r.setToValue(t.getToValue());
        r.setToId(t.getToId());
        r.setTransferDate(t.getTransferDate());
        r.setTransferTime(t.getTransferTime());
        r.setReason(t.getReason());
        r.setOrderedBy(t.getOrderedBy());
        r.setDoneBy(t.getDoneBy());
        r.setNotes(t.getNotes());
        r.setCreatedBy(t.getCreatedBy());
        r.setCreatedAt(t.getCreatedAt());
        return r;
    }
}
