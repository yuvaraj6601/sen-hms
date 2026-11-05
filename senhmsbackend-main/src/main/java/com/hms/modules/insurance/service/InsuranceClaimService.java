package com.hms.modules.insurance.service;

import com.hms.common.AuditLogService;
import com.hms.exception.ResourceNotFoundException;
import com.hms.modules.admission.entity.Admission;
import com.hms.modules.admission.enums.InsuranceWorkflowStatus;
import com.hms.modules.admission.repository.AdmissionRepository;
import com.hms.modules.billing.dto.InsuranceUpdateRequest;
import com.hms.modules.billing.dto.PaymentRequest;
import com.hms.modules.billing.enums.InsuranceStatus;
import com.hms.modules.billing.service.BillingService;
import com.hms.modules.insurance.dto.*;
import com.hms.modules.insurance.entity.InsuranceClaim;
import com.hms.modules.insurance.enums.ClaimStatus;
import com.hms.modules.insurance.repository.InsuranceClaimRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Lazy;
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
@Transactional
public class InsuranceClaimService {

    private final InsuranceClaimRepository repo;
    private final BillingService billingService;
    private final AuditLogService auditLogService;
    private final AdmissionRepository admissionRepo;

    public InsuranceClaimService(InsuranceClaimRepository repo,
                                 @Lazy BillingService billingService,
                                 AuditLogService auditLogService,
                                 AdmissionRepository admissionRepo) {
        this.repo = repo;
        this.billingService = billingService;
        this.auditLogService = auditLogService;
        this.admissionRepo = admissionRepo;
    }

    /**
     * Mirror the claim status onto its linked admission (claim is the single
     * source of truth; admission.insuranceStatus is a one-way mirror). The two
     * enums share identical value names, so we map by name.
     */
    private void syncAdmissionStatus(InsuranceClaim claim) {
        if (claim.getAdmissionId() == null) return;
        admissionRepo.findById(claim.getAdmissionId()).ifPresent(adm -> {
            try {
                InsuranceWorkflowStatus mapped =
                        InsuranceWorkflowStatus.valueOf(claim.getStatus().name());
                adm.setInsuranceStatus(mapped);
                admissionRepo.save(adm);
            } catch (IllegalArgumentException ignored) {
                // value names diverged — leave admission status unchanged
            }
        });
    }

    // ── Create claim ──────────────────────────────────────────────────────────

    public InsuranceClaimResponse create(InsuranceClaimRequest req) {
        log.info("[INSURANCE] Creating claim billId={} patient='{}' company='{}' claimed={}",
                req.getBillId(), req.getPatientName(), req.getInsuranceCompany(), req.getClaimedAmount());
        String claimNo = generateClaimNo(req.getSubmittedDate());

        InsuranceClaim claim = InsuranceClaim.builder()
                .claimNo(claimNo)
                .billId(req.getBillId())
                .billNo(req.getBillNo())
                .patientId(req.getPatientId())
                .patientName(req.getPatientName())
                .uhid(req.getUhid())
                .patientType(req.getPatientType())
                .admissionId(req.getAdmissionId())
                .admissionNo(req.getAdmissionNo())
                .admissionDate(req.getAdmissionDate())
                .dischargeDate(req.getDischargeDate())
                .diagnosis(req.getDiagnosis())
                .insuranceCompany(req.getInsuranceCompany())
                .insuranceCompanyId(req.getInsuranceCompanyId())
                .policyNo(req.getPolicyNo())
                .tpaName(req.getTpaName())
                .preAuthNumber(req.getPreAuthNumber())
                .billAmount(req.getBillAmount())
                .claimedAmount(req.getClaimedAmount())
                .submittedDate(req.getSubmittedDate())
                // A manually-created claim already has details → it has been sent
                // to the insurer for approval. (The pre-details stage lives on the
                // admission as DETAILS_INCOMPLETE before any claim exists.)
                .status(ClaimStatus.SENT_FOR_APPROVAL)
                .remarks(req.getRemarks())
                .build();

        InsuranceClaim saved = repo.save(claim);
        log.info("[INSURANCE] Created claimNo={} id={}", saved.getClaimNo(), saved.getId());
        auditLogService.log("InsuranceClaim", saved.getId(), "CREATE", currentUser(),
                "claimNo=" + saved.getClaimNo() + " patient=" + saved.getPatientName()
                        + " company=" + saved.getInsuranceCompany() + " claimed=" + saved.getClaimedAmount());
        syncAdmissionStatus(saved);
        return toResponse(saved);
    }

    // ── Auto create / update one claim per admission (from Cumulative gen) ──────

    /**
     * Called by BillingService when a CONSOLIDATED (Cumulative) bill is generated
     * for an insurance admission. Enforces ONE claim per admission: if a claim
     * already exists for the admission it is updated (bill link + amounts +
     * company/policy refreshed); otherwise a new claim is created in
     * SENT_FOR_APPROVAL. Settlement figures (approved/authorized/coPay/settled)
     * are never overwritten here — those are entered later in the claim.
     */
    public InsuranceClaim createOrUpdateForAdmission(Long admissionId, Long billId, String billNo,
                                                     Long patientId, String patientName, String uhid,
                                                     String admissionNo, LocalDate admissionDate,
                                                     LocalDate dischargeDate, String insuranceCompany,
                                                     Long insuranceCompanyId, String policyNo,
                                                     String tpaName, String preAuthNumber,
                                                     BigDecimal billAmount) {
        InsuranceClaim claim = (admissionId != null
                ? repo.findByAdmissionId(admissionId).orElse(null) : null);
        boolean isNew = claim == null;
        if (isNew) {
            claim = InsuranceClaim.builder()
                    .claimNo(generateClaimNo(LocalDate.now()))
                    .patientId(patientId)
                    .patientName(patientName)
                    .uhid(uhid)
                    .patientType("IP")
                    .admissionId(admissionId)
                    .submittedDate(LocalDate.now())
                    .status(ClaimStatus.SENT_FOR_APPROVAL)
                    .build();
        }
        // Always refresh the bill link + context from the latest cumulative.
        claim.setBillId(billId);
        claim.setBillNo(billNo);
        claim.setAdmissionNo(admissionNo);
        claim.setAdmissionDate(admissionDate);
        claim.setDischargeDate(dischargeDate);
        claim.setInsuranceCompany(insuranceCompany != null ? insuranceCompany : claim.getInsuranceCompany());
        claim.setInsuranceCompanyId(insuranceCompanyId != null ? insuranceCompanyId : claim.getInsuranceCompanyId());
        claim.setPolicyNo(policyNo != null ? policyNo : claim.getPolicyNo());
        claim.setTpaName(tpaName != null ? tpaName : claim.getTpaName());
        claim.setPreAuthNumber(preAuthNumber != null ? preAuthNumber : claim.getPreAuthNumber());
        claim.setBillAmount(billAmount);
        claim.setClaimedAmount(billAmount);
        // insuranceCompany is NOT NULL on the entity — guard a first-time create.
        if (claim.getInsuranceCompany() == null) claim.setInsuranceCompany("—");

        InsuranceClaim saved = repo.save(claim);
        auditLogService.log("InsuranceClaim", saved.getId(), isNew ? "AUTO_CREATE" : "AUTO_UPDATE",
                currentUser(), "claimNo=" + saved.getClaimNo() + " admissionId=" + admissionId
                        + " billNo=" + billNo + " billAmount=" + billAmount);
        syncAdmissionStatus(saved);
        return saved;
    }

    // ── Update status ─────────────────────────────────────────────────────────

    public InsuranceClaimResponse updateStatus(Long id, ClaimStatusRequest req) {
        log.info("[INSURANCE] updateStatus id={} newStatus={}", id, req.getStatus());
        InsuranceClaim claim = findOrThrow(id);
        ClaimStatus old = claim.getStatus();

        claim.setStatus(req.getStatus());
        if (req.getApprovedAmount() != null)   claim.setApprovedAmount(req.getApprovedAmount());
        if (req.getSettledAmount()  != null)   claim.setSettledAmount(req.getSettledAmount());
        if (req.getAuthorizedAmount() != null) claim.setAuthorizedAmount(req.getAuthorizedAmount());
        if (req.getCoPayAmount()    != null)   claim.setCoPayAmount(req.getCoPayAmount());
        if (req.getSettledDate()    != null)   claim.setSettledDate(req.getSettledDate());
        if (req.getRejectionReason() != null)  claim.setRejectionReason(req.getRejectionReason());
        if (StringUtils.hasText(req.getRemarks())) claim.setRemarks(req.getRemarks());

        // Auto-set settled date if not provided
        if (req.getStatus() == ClaimStatus.SETTLED && claim.getSettledDate() == null) {
            claim.setSettledDate(LocalDate.now());
        }

        // On DECLINE the insurer pays nothing: clear the approved amount so the
        // bill's close math charges the patient the FULL outstanding balance
        // (closeApproved falls back to 0 → patient owes bill − paid). Without
        // this, a stale approved figure from an earlier APPROVED state would let
        // the patient off and the hospital would silently write off the gap.
        if (req.getStatus() == ClaimStatus.DECLINED) {
            claim.setApprovedAmount(BigDecimal.ZERO);
            claim.setSettledAmount(null);
        }

        InsuranceClaim saved = repo.save(claim);

        // Mirror the new status onto the admission (claim is source of truth).
        syncAdmissionStatus(saved);

        log.info("[INSURANCE] Status updated claimNo={} from={} to={}",
                saved.getClaimNo(), old, req.getStatus());
        auditLogService.log("InsuranceClaim", id, "STATUS_UPDATE", currentUser(),
                "claimNo=" + saved.getClaimNo() + " from=" + old + " to=" + req.getStatus()
                        + (saved.getSettledAmount() != null ? " settled=" + saved.getSettledAmount() : ""));

        // ── Auto-sync bill when claim is SETTLED ──────────────────────────────
        // The insurer's money has now arrived, so it is recognised as revenue on
        // the SETTLEMENT DAY (not the discharge/close day). We:
        //   1. Record an INSURANCE payment on the linked bill DATED the settled
        //      date → this reduces dueAmount, books the amount as that day's
        //      revenue, and flips a patient-share-closed bill to PAID.
        //   2. Also stamp the bill's insurance metadata (status + paid figure).
        if (req.getStatus() == ClaimStatus.SETTLED && saved.getBillId() != null) {
            BigDecimal paidAmt = saved.getSettledAmount() != null ? saved.getSettledAmount()
                    : saved.getApprovedAmount() != null ? saved.getApprovedAmount()
                    : saved.getClaimedAmount();
            LocalDate settledOn = saved.getSettledDate() != null ? saved.getSettledDate() : LocalDate.now();
            if (paidAmt != null && paidAmt.compareTo(BigDecimal.ZERO) > 0) {
                // 1) Record the insurer payment as revenue on the settlement day.
                try {
                    PaymentRequest payReq = new PaymentRequest();
                    payReq.setAmount(paidAmt);
                    payReq.setPaymentMode(com.hms.modules.billing.enums.PaymentMode.INSURANCE);
                    payReq.setDate(settledOn);
                    payReq.setReferenceNo(saved.getClaimNo());
                    payReq.setReceivedBy(currentUser());
                    billingService.recordPayment(saved.getBillId(), payReq);
                } catch (Exception ignored) {
                    // Payment may be a no-op (bill already fully paid) — the
                    // INSURANCE path in recordPayment caps to due and is idempotent.
                }
                // 2) Stamp insurance status + paid figure metadata (idempotent).
                try {
                    InsuranceUpdateRequest billReq = new InsuranceUpdateRequest();
                    billReq.setInsuranceStatus(InsuranceStatus.SETTLED);
                    billReq.setInsurancePaidAmount(paidAmt);
                    if (StringUtils.hasText(req.getRemarks())) {
                        billReq.setInsuranceRemarks(req.getRemarks());
                    }
                    billingService.updateInsurance(saved.getBillId(), billReq);
                } catch (Exception ignored) {
                    // bill sync is best-effort — claim update already succeeded
                }
            }
        }

        return toResponse(saved);
    }

    // ── Search / list ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<InsuranceClaimResponse> search(String search, ClaimStatus status,
                                               String company,
                                               LocalDate dateFrom, LocalDate dateTo,
                                               Pageable pageable) {
        return repo.search(
                StringUtils.hasText(search)  ? search  : null,
                status,
                StringUtils.hasText(company) ? company : null,
                dateFrom, dateTo, pageable
        ).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public InsuranceClaimResponse getById(Long id) {
        InsuranceClaim claim = findOrThrow(id);
        InsuranceClaimResponse r = toResponse(claim);
        // Enrich with full bill details (items, ward, bed, doctor, amounts) for view/print
        if (claim.getBillId() != null) {
            try {
                r.setBillDetails(billingService.getById(claim.getBillId()));
            } catch (Exception ignored) {
                // bill may have been deleted — proceed without details
            }
        }
        return r;
    }

    @Transactional(readOnly = true)
    public List<InsuranceClaimResponse> getByPatient(Long patientId) {
        return repo.findByPatientIdOrderBySubmittedDateDesc(patientId)
                .stream().map(this::toResponse).toList();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String generateClaimNo(LocalDate date) {
        String prefix = date.format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        int seq = repo.findMaxClaimSeqForDate(prefix) + 1;
        return String.format("CLM-%s-%04d", prefix, seq);
    }

    private InsuranceClaim findOrThrow(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Insurance claim", id));
    }

    private InsuranceClaimResponse toResponse(InsuranceClaim c) {
        InsuranceClaimResponse r = new InsuranceClaimResponse();
        r.setId(c.getId());
        r.setClaimNo(c.getClaimNo());
        r.setBillId(c.getBillId());
        r.setBillNo(c.getBillNo());
        r.setPatientId(c.getPatientId());
        r.setPatientName(c.getPatientName());
        r.setUhid(c.getUhid());
        r.setPatientType(c.getPatientType());
        r.setAdmissionId(c.getAdmissionId());
        r.setAdmissionNo(c.getAdmissionNo());
        r.setAdmissionDate(c.getAdmissionDate());
        r.setDischargeDate(c.getDischargeDate());
        r.setDiagnosis(c.getDiagnosis());
        r.setInsuranceCompany(c.getInsuranceCompany());
        r.setInsuranceCompanyId(c.getInsuranceCompanyId());
        r.setPolicyNo(c.getPolicyNo());
        r.setTpaName(c.getTpaName());
        r.setPreAuthNumber(c.getPreAuthNumber());
        r.setBillAmount(c.getBillAmount());
        r.setClaimedAmount(c.getClaimedAmount());
        r.setApprovedAmount(c.getApprovedAmount());
        r.setSettledAmount(c.getSettledAmount());
        r.setAuthorizedAmount(c.getAuthorizedAmount());
        r.setCoPayAmount(c.getCoPayAmount());
        r.setRejectionReason(c.getRejectionReason());
        r.setStatus(c.getStatus());
        r.setSubmittedDate(c.getSubmittedDate());
        r.setSettledDate(c.getSettledDate());
        r.setRemarks(c.getRemarks());
        r.setCreatedBy(c.getCreatedBy());
        r.setCreatedAt(c.getCreatedAt());
        r.setUpdatedAt(c.getUpdatedAt());
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
