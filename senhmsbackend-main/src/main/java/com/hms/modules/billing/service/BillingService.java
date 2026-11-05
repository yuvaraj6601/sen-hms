package com.hms.modules.billing.service;

import com.hms.exception.DuplicateResourceException;
import com.hms.exception.ResourceNotFoundException;
import com.hms.common.AuditLogService;
import com.hms.modules.billing.dto.*;
import com.hms.modules.billing.entity.Bill;
import com.hms.modules.billing.entity.BillItem;
import com.hms.modules.billing.entity.PaymentRecord;
import com.hms.modules.billing.enums.BillStatus;
import com.hms.modules.billing.enums.InsuranceStatus;
import com.hms.modules.billing.enums.PaymentMode;
import com.hms.modules.billing.enums.ReceiptType;
import com.hms.modules.billing.repository.BillRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;

import com.hms.modules.admission.entity.Admission;
import com.hms.modules.admission.entity.TransferLog;
import com.hms.modules.admission.enums.TransferType;
import com.hms.modules.admission.repository.AdmissionRepository;
import com.hms.modules.admission.repository.TransferLogRepository;
import com.hms.modules.lab.entity.LabInvestigation;
import com.hms.modules.lab.enums.LabStatus;
import com.hms.modules.lab.repository.LabInvestigationRepository;
import com.hms.masters.entity.Ward;
import com.hms.masters.repository.WardRepository;
import java.time.temporal.ChronoUnit;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class BillingService {

    private final BillRepository repo;
    private final AdmissionRepository     admissionRepo;
    private final TransferLogRepository   transferRepo;
    private final LabInvestigationRepository labRepo;
    private final WardRepository          wardRepo;
    private final AuditLogService         auditLogService;
    private final com.hms.modules.insurance.repository.InsuranceClaimRepository insuranceClaimRepo;

    // Insurance claim service — field-injected with @Lazy to break the circular
    // dependency (InsuranceClaimService already depends on BillingService).
    // Used to auto-create/update one claim per admission when a Cumulative is
    // generated for an insurance admission.
    @Autowired @Lazy
    private com.hms.modules.insurance.service.InsuranceClaimService insuranceClaimService;

    // ── Create bill ───────────────────────────────────────────────────────────

    public BillResponse create(BillRequest req) {
        log.info("[BILLING] create patient='{}' uhid={} type={} amount={}",
                req.getPatientName(), req.getUhid(), req.getPatientType(), req.getAmountPaid());

        // ── One MAIN-IP-bill per admission guard ──────────────────────────────
        // An admission may carry only ONE open MAIN IP bill (towards IPD /
        // IP_FINAL, or the DRAFT the Collect Cash flow creates to hold receipts).
        // All ward charges + collected receipts live under that single bill, so a
        // second one would double-count ward charges and split the money trail.
        //
        // This guard ONLY applies when the NEW bill is itself a main IP bill, and
        // ONLY counts existing OPEN main IP bills as blockers. Lab, Pharmacy and
        // OPD counter bills are intentionally allowed to coexist with the main IP
        // bill (a lab test raises its own towards="Lab" bill, paid at the counter
        // and later folded into the IP bill as a receipt) — they must NOT trip the
        // guard, and the guard must NOT block them.
        if (isMainIpTowards(req.getTowards())) {
            Long resolvedAdmissionForGuard = resolveAdmissionId(
                    req.getAdmissionId(), req.getPatientId(), req.getPatientType());
            if (resolvedAdmissionForGuard != null) {
                Optional<Bill> openMainIp = repo.findOpenBillsForAdmission(resolvedAdmissionForGuard)
                        .stream()
                        .filter(b -> isMainIpTowards(b.getTowards()))
                        .findFirst();
                if (openMainIp.isPresent()) {
                    String existingBillNo = openMainIp.get().getBillNo();
                    throw new DuplicateResourceException(
                            "ONE_BILL_PER_ADMISSION:" + existingBillNo
                            + " — This admission already has an open bill (" + existingBillNo
                            + "). Open and edit that bill instead of creating a new one.");
                }
            }
        }

        String billNo = generateBillNo(req.getDate());

        // Calculate line totals
        List<BillItem> items = req.getItems().stream().map(line -> {
            BigDecimal lineTotal = line.getUnitPrice()
                    .multiply(BigDecimal.valueOf(line.getQuantity()))
                    .subtract(line.getDiscount() != null ? line.getDiscount() : BigDecimal.ZERO);
            lineTotal = lineTotal.max(BigDecimal.ZERO);
            return BillItem.builder()
                    .serviceCode(line.getServiceCode())
                    .modalityName(line.getModalityName())
                    .description(line.getDescription())
                    .quantity(line.getQuantity())
                    .unitPrice(line.getUnitPrice())
                    .discount(line.getDiscount() != null ? line.getDiscount() : BigDecimal.ZERO)
                    .total(lineTotal)
                    .hospitalRate(line.getHospitalRate())
                    .excluded(line.isExcluded())
                    .tariffNote(line.getTariffNote())
                    .serviceDate(line.getServiceDate())
                    .build();
        }).toList();

        BigDecimal subtotal = items.stream()
                .map(i -> i.getUnitPrice().multiply(BigDecimal.valueOf(i.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        // Overall (bill-level) discount overrides per-line discounts when provided.
        BigDecimal totalDiscount;
        BigDecimal totalAmount;
        if (req.getDiscount() != null && req.getDiscount().compareTo(BigDecimal.ZERO) > 0) {
            totalDiscount = req.getDiscount().min(subtotal).max(BigDecimal.ZERO);
            totalAmount   = subtotal.subtract(totalDiscount).max(BigDecimal.ZERO);
        } else {
            totalDiscount = items.stream()
                    .map(BillItem::getDiscount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            totalAmount = items.stream()
                    .map(BillItem::getTotal)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
        }

        BigDecimal amountPaid = req.isDraft() ? BigDecimal.ZERO
                : (req.getAmountPaid() != null ? req.getAmountPaid() : BigDecimal.ZERO);
        amountPaid = amountPaid.min(totalAmount);
        BigDecimal dueAmount = totalAmount.subtract(amountPaid).max(BigDecimal.ZERO);

        // An IP/BOTH bill is ALWAYS created as DRAFT and stays open until the
        // explicit closeBill() flow (discharge date) finalises it to PAID. IP
        // money is collected via receipts (Collect Cash), never inline, so there
        // is no PENDING/PARTIAL resting state for IP — the lifecycle is
        // DRAFT → receipts → close → PAID. This keeps the craft "Confirm Bill"
        // flow consistent with the edit flow (both leave the IP bill in DRAFT),
        // instead of the craft bill landing in PENDING and later showing PARTIAL
        // after a receipt.
        boolean isIpBill = "IP".equals(req.getPatientType()) || "BOTH".equals(req.getPatientType());

        // A fully-waived bill (total == 0, e.g. free OP consultation discounted to
        // zero) has nothing left to collect, so it closes as PAID. The dueAmount==0
        // check must come before the amountPaid==0 check for this to hold.
        BillStatus status = (req.isDraft() || isIpBill) ? BillStatus.DRAFT
                : dueAmount.compareTo(BigDecimal.ZERO) == 0 ? BillStatus.PAID
                : amountPaid.compareTo(BigDecimal.ZERO) == 0 ? BillStatus.PENDING
                : BillStatus.PARTIAL;

        Bill bill = Bill.builder()
                .billNo(billNo)
                .date(req.getDate())
                .patientId(req.getPatientId())
                .patientName(req.getPatientName())
                .uhid(req.getUhid())
                .patientType(req.getPatientType())
                .age(req.getAge())
                .gender(req.getGender())
                .phone(req.getPhone())
                .doctorName(req.getDoctorName())
                .department(req.getDepartment())
                .ward(req.getWard())
                .bedNumber(req.getBedNumber())
                .admittedDate(req.getAdmittedDate())
                .admittedTime(req.getAdmittedTime())
                .dischargeDate(req.getDischargeDate())
                .towards(req.getTowards())
                .admissionId(resolveAdmission(req))
                .visitId(req.getVisitId())
                .subtotal(subtotal)
                .totalDiscount(totalDiscount)
                .totalAmount(totalAmount)
                .paidAmount(amountPaid)
                .dueAmount(dueAmount)
                .initialCollected(req.getInitialCollected() != null ? req.getInitialCollected() : BigDecimal.ZERO)
                .refundAmount(req.getRefundAmount() != null ? req.getRefundAmount() : BigDecimal.ZERO)
                // A bill is "free" only when it nets to ₹0 (consultation waived and
                // no other payable services). Derived server-side so it can't be spoofed.
                .free(!req.isDraft() && totalAmount.compareTo(BigDecimal.ZERO) == 0)
                .paymentMode(req.getPaymentMode())
                .referenceNo(req.getReferenceNo())
                .status(status)
                .insurance(req.isInsurance())
                .insuranceCompany(req.getInsuranceCompany())
                .insuranceCompanyId(req.getInsuranceCompanyId())
                .policyNo(req.getPolicyNo())
                .insuredPersonName(req.getInsuredPersonName())
                .cardNumber(req.getCardNumber())
                .claimedAmount(req.getClaimedAmount())
                .insuranceStatus(req.isInsurance() ? InsuranceStatus.PENDING : null)
                .insuranceTariffApplied(req.isInsuranceTariffApplied())
                .build();

        // Set bill reference on items
        items.forEach(item -> item.setBill(bill));
        bill.getItems().addAll(items);

        // Add initial payment record if payment was made
        if (!req.isDraft() && amountPaid.compareTo(BigDecimal.ZERO) > 0) {
            PaymentRecord pr = PaymentRecord.builder()
                    .bill(bill)
                    .date(req.getDate())
                    .amount(amountPaid)
                    .paymentMode(req.getPaymentMode())
                    .referenceNo(req.getReferenceNo())
                    .receivedBy(req.getCreatedBy())
                    .build();
            bill.getPayments().add(pr);
        }

        Bill savedBill = repo.save(bill);

        // Mark lab investigations as billed — prevents them appearing in future prefill
        req.getItems().stream()
            .filter(line -> line.getLabId() != null)
            .forEach(line -> labRepo.findById(line.getLabId()).ifPresent(lab -> {
                lab.setBilledInBillId(savedBill.getId());
                labRepo.save(lab);
            }));

        log.info("[BILLING] Created billNo={} id={} total={} status={}",
                savedBill.getBillNo(), savedBill.getId(), savedBill.getTotalAmount(), savedBill.getStatus());
        auditLogService.log("Bill", savedBill.getId(), "CREATE", currentUser(),
                "billNo=" + savedBill.getBillNo() + " total=" + savedBill.getTotalAmount()
                        + " paid=" + savedBill.getPaidAmount() + " status=" + savedBill.getStatus());

        // If a lab bill is created already fully paid, release its tests immediately.
        syncLabStatusForPaidBill(savedBill);

        return toResponse(savedBill);
    }

    // ── Update (Draft / Pending only) ─────────────────────────────────────────

    public BillResponse update(Long id, BillRequest req) {
        Bill bill = findOrThrow(id);
        if (bill.getStatus() == BillStatus.PAID || bill.getStatus() == BillStatus.CANCELLED) {
            throw new DuplicateResourceException("Cannot edit a " + bill.getStatus() + " bill");
        }

        // Rebuild items
        bill.getItems().clear();
        req.getItems().forEach(line -> {
            BigDecimal lineTotal = line.getUnitPrice()
                    .multiply(BigDecimal.valueOf(line.getQuantity()))
                    .subtract(line.getDiscount() != null ? line.getDiscount() : BigDecimal.ZERO)
                    .max(BigDecimal.ZERO);
            BillItem item = BillItem.builder()
                    .bill(bill)
                    .serviceCode(line.getServiceCode())
                    .modalityName(line.getModalityName())
                    .description(line.getDescription())
                    .quantity(line.getQuantity())
                    .unitPrice(line.getUnitPrice())
                    .discount(line.getDiscount() != null ? line.getDiscount() : BigDecimal.ZERO)
                    .total(lineTotal)
                    .hospitalRate(line.getHospitalRate())
                    .excluded(line.isExcluded())
                    .tariffNote(line.getTariffNote())
                    .serviceDate(line.getServiceDate())
                    .build();
            bill.getItems().add(item);
        });

        BigDecimal subtotal = bill.getItems().stream()
                .map(i -> i.getUnitPrice().multiply(BigDecimal.valueOf(i.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        // Overall (bill-level) discount overrides per-line discounts when provided.
        BigDecimal totalDiscount;
        BigDecimal totalAmount;
        if (req.getDiscount() != null && req.getDiscount().compareTo(BigDecimal.ZERO) > 0) {
            totalDiscount = req.getDiscount().min(subtotal).max(BigDecimal.ZERO);
            totalAmount   = subtotal.subtract(totalDiscount).max(BigDecimal.ZERO);
        } else {
            totalDiscount = bill.getItems().stream()
                    .map(BillItem::getDiscount).reduce(BigDecimal.ZERO, BigDecimal::add);
            totalAmount = bill.getItems().stream()
                    .map(BillItem::getTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        }
        BigDecimal dueAmount = totalAmount.subtract(bill.getPaidAmount()).max(BigDecimal.ZERO);

        bill.setDate(req.getDate());
        bill.setDoctorName(req.getDoctorName());
        bill.setDepartment(req.getDepartment());
        if (req.getAdmittedDate() != null) bill.setAdmittedDate(req.getAdmittedDate());
        if (req.getAdmittedTime() != null) bill.setAdmittedTime(req.getAdmittedTime());
        if (req.getDischargeDate() != null) bill.setDischargeDate(req.getDischargeDate());
        bill.setTowards(req.getTowards());
        bill.setSubtotal(subtotal);
        bill.setTotalDiscount(totalDiscount);
        bill.setTotalAmount(totalAmount);
        bill.setDueAmount(dueAmount);
        bill.setInsurance(req.isInsurance());
        bill.setInsuranceCompany(req.getInsuranceCompany());
        bill.setPolicyNo(req.getPolicyNo());
        bill.setInsuredPersonName(req.getInsuredPersonName());
        bill.setCardNumber(req.getCardNumber());
        bill.setClaimedAmount(req.getClaimedAmount());
        bill.setInsuranceTariffApplied(req.isInsuranceTariffApplied());

        // Recalculate status. A zero-due bill (fully paid or fully waived to a
        // zero total) is PAID; check dueAmount==0 before paidAmount==0 so a
        // waived-to-zero bill closes rather than staying PENDING.
        //
        // IP/BOTH bills are EXCLUDED from the auto-PAID here: an IP bill must
        // only reach PAID via the explicit closeBill() flow (discharge date),
        // never from a plain Update save. Saving the discharge date (or any
        // other edit) must NOT finalise the bill — otherwise clicking "Update
        // Bill" after collecting the full amount would auto-close it, bypassing
        // the explicit Close step. IP bills stay DRAFT/PARTIAL until close.
        boolean isIpBill = "IP".equals(bill.getPatientType()) || "BOTH".equals(bill.getPatientType());
        if (bill.getStatus() != BillStatus.DRAFT && !isIpBill) {
            if (dueAmount.compareTo(BigDecimal.ZERO) == 0) bill.setStatus(BillStatus.PAID);
            else if (bill.getPaidAmount().compareTo(BigDecimal.ZERO) == 0) bill.setStatus(BillStatus.PENDING);
            else bill.setStatus(BillStatus.PARTIAL);
        }

        return toResponse(repo.save(bill));
    }

    // ── Record payment ────────────────────────────────────────────────────────

    public BillResponse recordPayment(Long id, PaymentRequest req) {
        log.info("[BILLING] recordPayment billId={} amount={} mode={}", id, req.getAmount(), req.getPaymentMode());
        Bill bill = findOrThrow(id);
        if (bill.getStatus() == BillStatus.PAID) {
            throw new DuplicateResourceException("Bill is already fully paid");
        }
        if (bill.getStatus() == BillStatus.CANCELLED) {
            throw new DuplicateResourceException("Cannot record payment on a cancelled bill");
        }

        // For INSURANCE payments, cap at the due amount rather than rejecting —
        // insurance settlements may differ from the exact due balance.
        // For all other modes, reject if amount exceeds balance (as before).
        BigDecimal amount = req.getAmount();
        if (req.getPaymentMode() == com.hms.modules.billing.enums.PaymentMode.INSURANCE) {
            if (bill.getDueAmount().compareTo(BigDecimal.ZERO) == 0) {
                // Nothing left to pay — skip silently (idempotent)
                return toResponse(bill);
            }
            amount = amount.min(bill.getDueAmount());
        } else {
            if (amount.compareTo(bill.getDueAmount()) > 0) {
                throw new DuplicateResourceException(
                        "Amount " + amount + " exceeds balance " + bill.getDueAmount());
            }
        }

        PaymentRecord pr = PaymentRecord.builder()
                .bill(bill)
                .date(req.getDate() != null ? req.getDate() : LocalDate.now())
                .amount(amount)
                .paymentMode(req.getPaymentMode())
                .referenceNo(req.getReferenceNo())
                .receivedBy(req.getReceivedBy())
                .transactionGroupId(req.getTransactionGroupId())
                .build();
        bill.getPayments().add(pr);

        BigDecimal newPaid = bill.getPaidAmount().add(amount);
        BigDecimal newDue  = bill.getTotalAmount().subtract(newPaid).max(BigDecimal.ZERO);
        bill.setPaidAmount(newPaid);
        bill.setDueAmount(newDue);
        bill.setPaymentMode(req.getPaymentMode());
        bill.setReferenceNo(req.getReferenceNo());
        // An IP/BOTH bill must NEVER auto-close to PAID on a receipt payment —
        // it only becomes PAID through the explicit closeBill() flow (which
        // requires the discharge date). A full-payment receipt on an IP bill
        // therefore settles it to PARTIAL (patient paid in full, bill still
        // open) or keeps a DRAFT draft; it never flips to PAID here. This
        // matches the intended state machine: DRAFT → receipts → close (with
        // discharge date) → PAID, and fixes the craft flow auto-closing on full
        // payment while the edit flow correctly waits for close.
        //
        // OP / counter bills keep the immediate settle-to-PAID behaviour, since
        // they have no discharge-date close step.
        boolean isIpBill = "IP".equals(bill.getPatientType()) || "BOTH".equals(bill.getPatientType());
        boolean isInsuranceSettlement =
                req.getPaymentMode() == com.hms.modules.billing.enums.PaymentMode.INSURANCE;
        if (bill.getStatus() != BillStatus.DRAFT) {
            if (isIpBill && !isInsuranceSettlement) {
                // A PATIENT receipt on an IP bill never auto-closes it — the
                // bill stays PARTIAL (patient paid in full or part) and becomes
                // PAID only via the explicit closeBill() flow (discharge date).
                // EXCEPTION: the insurer's INSURANCE-mode settlement is the
                // "booked as revenue on settlement day" step — when it clears
                // the balance it SHOULD flip the bill to PAID (handled below).
                bill.setStatus(BillStatus.PARTIAL);
            } else {
                bill.setStatus(newDue.compareTo(BigDecimal.ZERO) == 0 ? BillStatus.PAID : BillStatus.PARTIAL);
            }
        }

        // If payment mode is INSURANCE, accumulate into insurancePaidAmount
        if (req.getPaymentMode() == com.hms.modules.billing.enums.PaymentMode.INSURANCE) {
            BigDecimal existing = bill.getInsurancePaidAmount() != null
                    ? bill.getInsurancePaidAmount() : BigDecimal.ZERO;
            bill.setInsurancePaidAmount(existing.add(amount));
        }

        Bill saved = repo.save(bill);
        log.info("[BILLING] Payment recorded billNo={} amount={} newStatus={}",
                saved.getBillNo(), amount, saved.getStatus());
        auditLogService.log("Bill", id, "PAYMENT", currentUser(),
                "billNo=" + saved.getBillNo() + " amount=" + amount
                        + " mode=" + req.getPaymentMode() + " status=" + saved.getStatus());

        // Lab estimation gate: when a bill that carries lab tests is fully paid,
        // release those tests for processing (AWAITING_PAYMENT → PAID).
        syncLabStatusForPaidBill(saved);

        return toResponse(saved);
    }

    // ── Collect Cash (advance / settlement / refund) ────────────────────────────

    /**
     * Records a "Collect Cash" receipt against the admission's SINGLE bill.
     *
     * Model: one bill per admission, many receipts under it. The first collection
     * creates a DRAFT IP bill (₹0 services) to hold the money; later collections
     * attach to that same bill. At discharge the services are added to this same
     * bill and it becomes the final split-up bill.
     *
     * Receipt types:
     *   ADVANCE / SETTLEMENT — positive amount (money in)
     *   REFUND               — negative amount (money returned)
     *
     * Splits (MIXED) carry a JSON breakdown. The receipt is one PaymentRecord;
     * for a split we still store one record with mode=MIXED + the splits JSON so
     * the ledger shows the combined receipt (breakdown available on the record).
     */
    public BillResponse collect(CollectRequest req) {
        log.info("[BILLING] collect patientId={} admissionId={} type={} amount={} mode={}",
                req.getPatientId(), req.getAdmissionId(), req.getReceiptType(),
                req.getAmount(), req.getPaymentMode());

        // Validate sign against receipt type.
        BigDecimal amount = req.getAmount();
        if (amount == null || amount.compareTo(BigDecimal.ZERO) == 0) {
            throw new DuplicateResourceException("Receipt amount must be non-zero");
        }
        boolean negative = amount.compareTo(BigDecimal.ZERO) < 0;
        if (req.getReceiptType() == ReceiptType.REFUND && !negative) {
            amount = amount.negate(); // normalise refunds to negative
        } else if (req.getReceiptType() != ReceiptType.REFUND && negative) {
            throw new DuplicateResourceException(req.getReceiptType() + " amount must be positive");
        }

        // Resolve the admission (fallback to the patient's active admission).
        Long admissionId = req.getAdmissionId();
        if (admissionId == null) {
            admissionId = admissionRepo.findActiveByPatientId(req.getPatientId())
                    .map(Admission::getId)
                    .orElse(null);
        }

        // Find the admission's single open bill, else create a DRAFT to hold receipts.
        Bill bill = resolveAdmissionBill(admissionId, req);

        LocalDate when = req.getDate() != null ? req.getDate() : LocalDate.now();
        PaymentRecord pr = PaymentRecord.builder()
                .bill(bill)
                .date(when)
                .amount(amount)
                .paymentMode(req.getPaymentMode())
                .referenceNo(req.getReferenceNo())
                .receivedBy(req.getReceivedBy())
                .transactionGroupId(req.getTransactionGroupId())
                .receiptType(req.getReceiptType())
                .receiptNo(generateReceiptNo(when))
                .paymentSplitsJson(
                        req.getPaymentMode() == PaymentMode.MIXED ? req.getPaymentSplitsJson() : null)
                .build();
        bill.getPayments().add(pr);

        // Recompute paid / due. Advances on a ₹0-item draft produce a credit
        // (paid > total) — due is floored at 0 and the credit shows on the ledger.
        BigDecimal newPaid = bill.getPaidAmount().add(amount);
        if (newPaid.compareTo(BigDecimal.ZERO) < 0) newPaid = BigDecimal.ZERO;
        BigDecimal newDue = bill.getTotalAmount().subtract(newPaid).max(BigDecimal.ZERO);
        bill.setPaidAmount(newPaid);
        bill.setDueAmount(newDue);
        bill.setPaymentMode(req.getPaymentMode());

        // Status rules:
        //  • A draft (no services) stays DRAFT — just an advance-receipt holder.
        //  • An IP/BOTH bill must NEVER auto-close to PAID from a receipt. It
        //    only becomes PAID via the explicit closeBill() flow (discharge
        //    date) or an insurer INSURANCE-mode settlement. A full patient
        //    receipt settles it to PARTIAL (paid in full, bill still open).
        //    This mirrors recordPayment()'s IP guard so the craft flow (which
        //    creates a non-draft PENDING bill) no longer auto-closes on a full
        //    receipt, matching the edit flow.
        //  • OP / counter bills settle to PAID/PENDING/PARTIAL immediately.
        boolean isIpBill = "IP".equals(bill.getPatientType()) || "BOTH".equals(bill.getPatientType());
        boolean isInsuranceSettlement = req.getPaymentMode() == PaymentMode.INSURANCE;
        if (bill.getStatus() != BillStatus.DRAFT) {
            if (isIpBill && !isInsuranceSettlement) {
                bill.setStatus(BillStatus.PARTIAL);
            } else {
                bill.setStatus(newDue.compareTo(BigDecimal.ZERO) == 0 ? BillStatus.PAID
                        : newPaid.compareTo(BigDecimal.ZERO) == 0 ? BillStatus.PENDING
                        : BillStatus.PARTIAL);
            }
        }

        Bill saved = repo.save(bill);
        log.info("[BILLING] collect recorded receiptNo={} billNo={} paid={} due={}",
                pr.getReceiptNo(), saved.getBillNo(), saved.getPaidAmount(), saved.getDueAmount());
        auditLogService.log("Bill", saved.getId(), "COLLECT_" + req.getReceiptType(), currentUser(),
                "billNo=" + saved.getBillNo() + " receiptNo=" + pr.getReceiptNo()
                        + " amount=" + amount + " mode=" + req.getPaymentMode());
        return toResponse(saved);
    }

    /**
     * Finds the admission's single open bill (DRAFT / PENDING / PARTIAL), or
     * creates a new DRAFT IP bill with no items to hold receipts.
     */
    private Bill resolveAdmissionBill(Long admissionId, CollectRequest req) {
        if (admissionId != null) {
            List<Bill> open = repo.findByAdmissionIdOrderByDateDesc(admissionId).stream()
                    .filter(b -> !b.isConsolidated())
                    .filter(b -> b.getStatus() == BillStatus.DRAFT
                            || b.getStatus() == BillStatus.PENDING
                            || b.getStatus() == BillStatus.PARTIAL)
                    .toList();
            if (!open.isEmpty()) return open.get(0);
        }

        // None — create a DRAFT IP bill for this admission.
        LocalDate today = LocalDate.now();
        Bill draft = Bill.builder()
                .billNo(generateBillNo(today))
                .date(today)
                .patientId(req.getPatientId())
                .patientName(req.getPatientName())
                .uhid(req.getUhid())
                .patientType("IP")
                .age(req.getAge())
                .gender(req.getGender())
                .phone(req.getPhone())
                .doctorName(req.getDoctorName())
                .department(req.getDepartment())
                .ward(req.getWard())
                .bedNumber(req.getBedNumber())
                .towards("IPD")
                .admissionId(admissionId)
                .subtotal(BigDecimal.ZERO)
                .totalDiscount(BigDecimal.ZERO)
                .totalAmount(BigDecimal.ZERO)
                .paidAmount(BigDecimal.ZERO)
                .dueAmount(BigDecimal.ZERO)
                .status(BillStatus.DRAFT)
                .build();
        return draft;
    }

    private String generateReceiptNo(LocalDate date) {
        String prefix = date.format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        int seq = repo.findMaxReceiptSeqForDate(prefix) + 1;
        return String.format("RCPT-%s-%04d", prefix, seq);
    }

    /**
     * When a bill becomes fully PAID, flip any lab tests stamped into it from
     * AWAITING_PAYMENT to PAID so the lab can collect samples and process.
     * No-op for bills with no linked lab tests or not yet fully paid.
     */
    private void syncLabStatusForPaidBill(Bill bill) {
        if (bill.getStatus() != BillStatus.PAID) return;
        List<LabInvestigation> labs = labRepo.findByBilledInBillId(bill.getId());
        for (LabInvestigation lab : labs) {
            if (lab.getStatus() == LabStatus.AWAITING_PAYMENT) {
                lab.setStatus(LabStatus.PAID);
                labRepo.save(lab);
                auditLogService.log("Lab", lab.getId(), "PAID", currentUser(),
                        "labId=" + lab.getLabId() + " billNo=" + bill.getBillNo());
            }
        }
    }

    // ── Lock to insurance approved amount ──────────────────────────────────────

    /**
     * Close an insurance bill at the insurer's approved amount.
     * The remaining balance (bill total − insurance paid) is written off as an
     * off-record patient collection (cash in hand). It is NOT recorded as a
     * PaymentRecord and does NOT count as system revenue.
     *
     * After this the bill is PAID and locked (admin reopen only).
     *
     * Precondition: the bill is an insurance bill with some insurancePaidAmount
     * recorded and a positive remaining due.
     */
    public BillResponse lockToInsuranceApproved(Long id) {
        Bill bill = findOrThrow(id);

        if (!bill.isInsurance()) {
            throw new DuplicateResourceException("Only insurance bills can be locked to approved amount");
        }
        if (bill.getStatus() == BillStatus.CANCELLED) {
            throw new DuplicateResourceException("Cannot lock a cancelled bill");
        }
        if (bill.isInsuranceLocked()) {
            throw new DuplicateResourceException("Bill is already locked to the approved amount");
        }

        BigDecimal gap = bill.getDueAmount() != null ? bill.getDueAmount() : BigDecimal.ZERO;
        if (gap.compareTo(BigDecimal.ZERO) <= 0) {
            throw new DuplicateResourceException("Bill has no outstanding balance to write off");
        }

        // Write off the gap — collected in hand, off the system.
        bill.setInsuranceWriteOff(gap);
        bill.setDueAmount(BigDecimal.ZERO);
        bill.setInsuranceLocked(true);
        bill.setStatus(BillStatus.PAID);
        // NOTE: paidAmount is intentionally left as the insurance-paid figure.
        // The gap is a write-off, not a recorded payment, so revenue = insurance settled only.

        Bill saved = repo.save(bill);
        log.info("[BILLING] Locked to insurance approved billNo={} writeOff={} insurancePaid={}",
                saved.getBillNo(), gap, saved.getInsurancePaidAmount());
        auditLogService.log("Bill", id, "LOCK_INSURANCE_APPROVED", currentUser(),
                "billNo=" + saved.getBillNo() + " writeOff=" + gap
                        + " insurancePaid=" + saved.getInsurancePaidAmount());
        return toResponse(saved);
    }

    /**
     * Admin-only: reopen a bill that was locked to the insurance approved amount.
     * Restores the written-off gap as an outstanding balance so it can be
     * collected through the system or re-locked.
     */
    public BillResponse reopenInsuranceLocked(Long id) {
        Bill bill = findOrThrow(id);
        if (!bill.isInsuranceLocked()) {
            throw new DuplicateResourceException("Bill is not locked");
        }
        BigDecimal writeOff = bill.getInsuranceWriteOff() != null ? bill.getInsuranceWriteOff() : BigDecimal.ZERO;
        bill.setDueAmount(writeOff);
        bill.setInsuranceWriteOff(null);
        bill.setInsuranceLocked(false);
        bill.setStatus(writeOff.compareTo(BigDecimal.ZERO) > 0 ? BillStatus.PARTIAL : BillStatus.PAID);

        Bill saved = repo.save(bill);
        log.info("[BILLING] Reopened insurance-locked billNo={} restoredDue={}", saved.getBillNo(), writeOff);
        auditLogService.log("Bill", id, "REOPEN_INSURANCE_LOCKED", currentUser(),
                "billNo=" + saved.getBillNo() + " restoredDue=" + writeOff);
        return toResponse(saved);
    }

    // ── Close bill (mark PAID — finalises the IP bill at discharge) ───────────

    /**
     * Closes the IP bill by setting its status to PAID. The bill may only be
     * closed once its ENTIRE balance has been collected — i.e. dueAmount is 0.
     * If any amount is still outstanding, closing is blocked: the balance must
     * first be recorded through Collect Cash (or written off via the insurance
     * lock) so it is never silently dropped from the books.
     *
     * This cannot be undone. After closing, the patient's case-sheet Discharge
     * Summary becomes accessible. Does NOT discharge the admission — that
     * remains a separate action in the case sheet.
     */
    public BillResponse closeBill(Long id) {
        Bill bill = findOrThrow(id);
        if (bill.getStatus() == BillStatus.CANCELLED) {
            throw new DuplicateResourceException("Cannot close a cancelled bill");
        }
        if (bill.getStatus() == BillStatus.PAID) {
            throw new DuplicateResourceException("Bill is already closed (PAID)");
        }
        if (bill.isPatientShareClosed()) {
            throw new DuplicateResourceException("Bill is already closed (patient share settled)");
        }
        if (bill.getStatus() == BillStatus.CONSOLIDATED) {
            throw new DuplicateResourceException("This is a view-only consolidated document and cannot be closed");
        }

        BigDecimal due = bill.getDueAmount() != null ? bill.getDueAmount() : BigDecimal.ZERO;

        // ── INSURANCE bill: gate on the PATIENT's share, not the full balance ──
        // The insurer's approved amount is a receivable that arrives later (by
        // cheque/bank, ~45 days). We allow the bill to be CLOSED once the patient
        // has settled their own share:
        //   patientNet = billTotal − insurerApproved − patientPaid
        //     > 0  → patient still owes  → collect (Collect Cash) first, block
        //     < 0  → patient overpaid    → refund (Collect Cash → Refund), block
        //     == 0 → finalise: keep insurerApproved as an outstanding RECEIVABLE
        //            (dueAmount), mark patientShareClosed, leave status PARTIAL.
        //            Revenue for the insurer share is booked only when the claim
        //            is SETTLED (that records a dated payment that flips to PAID).
        if (bill.isInsurance()) {
            BigDecimal approved = BigDecimal.ZERO;
            if (bill.getAdmissionId() != null) {
                approved = insuranceClaimRepo.findByAdmissionId(bill.getAdmissionId())
                        .map(c -> c.getApprovedAmount() != null ? c.getApprovedAmount() : BigDecimal.ZERO)
                        .orElse(BigDecimal.ZERO);
            }
            if (approved.compareTo(BigDecimal.ZERO) == 0 && bill.getInsurancePaidAmount() != null) {
                // Fall back to any insurance-paid figure recorded on the bill.
                approved = bill.getInsurancePaidAmount();
            }
            BigDecimal total = bill.getTotalAmount() != null ? bill.getTotalAmount() : BigDecimal.ZERO;
            BigDecimal paid  = bill.getPaidAmount()  != null ? bill.getPaidAmount()  : BigDecimal.ZERO;
            BigDecimal patientNet = total.subtract(approved).subtract(paid);

            if (patientNet.compareTo(BigDecimal.ZERO) > 0) {
                throw new DuplicateResourceException(
                        "Cannot close — patient balance of " + patientNet
                        + " is still due (bill " + total + " − insurance approved " + approved
                        + " − paid " + paid + "). Collect it (Collect Cash) first.");
            }
            if (patientNet.compareTo(BigDecimal.ZERO) < 0) {
                throw new DuplicateResourceException(
                        "Cannot close — a refund of " + patientNet.abs()
                        + " is due to the patient (collected more than the patient's share after "
                        + "insurance approval). Record it via Collect Cash → Refund first.");
            }

            // patientNet == 0 → finalise the patient share.
            if (approved.compareTo(BigDecimal.ZERO) > 0 && due.compareTo(BigDecimal.ZERO) > 0) {
                // Insurer still owes the approved amount — keep it as a receivable.
                bill.setPatientShareClosed(true);
                // dueAmount stays = approved receivable; status stays PARTIAL.
                if (bill.getStatus() == BillStatus.DRAFT) bill.setStatus(BillStatus.PARTIAL);
                Bill saved = repo.save(bill);
                log.info("[BILLING] Patient-share closed billNo={} insurerReceivable={} (PARTIAL)",
                        saved.getBillNo(), due);
                auditLogService.log("Bill", id, "CLOSE_PATIENT_SHARE", currentUser(),
                        "billNo=" + saved.getBillNo() + " insurerReceivable=" + due
                                + " approved=" + approved + " patientPaid=" + paid);
                return toResponse(saved);
            }
            // No insurer receivable pending (approved covers nothing left, or the
            // whole bill is already paid) → close fully as PAID below.
        } else {
            // ── CASH bill: full balance must be cleared before closing. ──
            if (due.compareTo(BigDecimal.ZERO) > 0) {
                throw new DuplicateResourceException(
                        "Cannot close this bill — an outstanding balance of " + due
                        + " is still due. Collect the balance (Collect Cash) first, then close the bill.");
            }
        }

        bill.setStatus(BillStatus.PAID);
        bill.setDueAmount(BigDecimal.ZERO);
        bill.setPatientShareClosed(true);
        Bill saved = repo.save(bill);
        log.info("[BILLING] Closed billNo={} (PAID)", saved.getBillNo());
        auditLogService.log("Bill", id, "CLOSE_BILL", currentUser(),
                "billNo=" + saved.getBillNo() + " totalAmount=" + saved.getTotalAmount()
                        + " paidAmount=" + saved.getPaidAmount());
        return toResponse(saved);
    }

    // ── Cancel bill ───────────────────────────────────────────────────────────

    public BillResponse cancel(Long id, CancelBillRequest req) {
        log.info("[BILLING] cancel billId={}", id);
        Bill bill = findOrThrow(id);
        if (bill.getStatus() == BillStatus.PAID) {
            throw new DuplicateResourceException("Cannot cancel a paid bill");
        }
        if (bill.getStatus() == BillStatus.CANCELLED) {
            throw new DuplicateResourceException("Bill is already cancelled");
        }
        bill.setStatus(BillStatus.CANCELLED);
        bill.setCancellationReason(req.getReason());
        Bill saved = repo.save(bill);
        log.info("[BILLING] Cancelled billNo={}", saved.getBillNo());
        auditLogService.log("Bill", id, "CANCEL", currentUser(),
                "billNo=" + saved.getBillNo() + " reason=" + req.getReason());
        return toResponse(saved);
    }

    // ── Consolidate / Summary IP bill ───────────────────────────────────────────

    /**
     * Generate view-only Consolidated and/or Summary IP documents from the
     * selected source bills of an admission.
     *
     * Rules (agreed with product owner):
     *  - These are VIEW-ONLY documents. The money already lives in the individual
     *    source bills, so the consolidated / summary rows are EXCLUDED from all
     *    revenue totals (status {@link BillStatus#CONSOLIDATED}, which the revenue
     *    queries skip). The source bills are left completely untouched — same
     *    status, still counted.
     *  - One listed bill is created per requested format (CONSOLIDATED, SUMMARY),
     *    each a copy of the merged source items so it can be reopened/reprinted
     *    in its own layout. {@code billFormat} records which layout the row is.
     *  - CASH admission: hard-blocked unless every selected source bill is fully
     *    paid. INSURANCE admission: allowed with an outstanding balance.
     *  - On regenerate, prior view-only consolidated/summary docs for the
     *    admission are CANCELLED and linked via {@code supersededByBillId} (4b).
     *  - {@code dischargeDate} is stored for display only; the admission is untouched.
     */
    public List<BillResponse> consolidate(ConsolidateBillRequest req) {
        log.info("[BILLING] consolidate admissionId={} billIds={} formats={} dischargeDate={}",
                req.getAdmissionId(), req.getBillIds(), req.getFormats(), req.getDischargeDate());

        // ── Resolve requested formats (default CONSOLIDATED) ──────────────────
        List<String> formats = (req.getFormats() == null || req.getFormats().isEmpty())
                ? List.of("CONSOLIDATED")
                : req.getFormats().stream()
                    .map(f -> f == null ? "" : f.trim().toUpperCase())
                    .filter(f -> f.equals("CONSOLIDATED") || f.equals("SUMMARY"))
                    .distinct()
                    .toList();
        if (formats.isEmpty()) {
            throw new DuplicateResourceException("No valid bill format requested (CONSOLIDATED / SUMMARY)");
        }

        // ── Load + validate source bills ──────────────────────────────────────
        List<Bill> sources = new ArrayList<>();
        for (Long id : req.getBillIds()) {
            Bill b = findOrThrow(id);
            if (b.isConsolidated()) {
                throw new DuplicateResourceException(
                        "Bill " + b.getBillNo() + " is itself a consolidated/summary document and cannot be merged");
            }
            if (b.getStatus() == BillStatus.CANCELLED) {
                throw new DuplicateResourceException(
                        "Cannot consolidate a cancelled bill (" + b.getBillNo() + ")");
            }
            if (b.getAdmissionId() == null || !b.getAdmissionId().equals(req.getAdmissionId())) {
                throw new DuplicateResourceException(
                        "Bill " + b.getBillNo() + " does not belong to admission " + req.getAdmissionId());
            }
            sources.add(b);
        }
        if (sources.isEmpty()) {
            throw new DuplicateResourceException("No valid source bills to consolidate");
        }

        // ── Cash vs insurance ─────────────────────────────────────────────────
        // Insurance if ANY source bill is an insurance bill; otherwise cash.
        //
        // NOTE: generation is intentionally NOT gated on full payment (for cash
        // OR insurance). The Cumulative bill is the stage where the patient's
        // discount is applied and the net payable is established, so it must be
        // generated BEFORE the balance is collected (discharge-first flow). The
        // real financial lock lives in closeBill(): a bill cannot be closed while
        // a balance is still due or a refund is owed.
        boolean insurance = sources.stream().anyMatch(Bill::isInsurance);

        // ── Snapshot existing view-only docs BEFORE creating new ones (4b) ────
        // Captured up-front so a doc created in THIS call can never be treated as
        // a prior doc to supersede.
        List<Bill> prior = repo.findByAdmissionIdOrderByDateDesc(req.getAdmissionId())
                .stream()
                .filter(Bill::isConsolidated)
                .filter(b -> b.getStatus() != BillStatus.CANCELLED)
                .toList();

        // The exact set of source bills this request is built from (order-independent).
        String sourceKey = sources.stream()
                .map(b -> String.valueOf(b.getId()))
                .sorted()
                .collect(java.util.stream.Collectors.joining(","));

        // ── Create one view-only document per requested format ────────────────
        // Supersede is PER FORMAT: regenerating a SUMMARY only cancels an older
        // SUMMARY; a CONSOLIDATED only cancels an older CONSOLIDATED. The two are
        // independent documents and must not cancel each other.
        List<BillResponse> results = new ArrayList<>();
        for (String format : formats) {

            // ── No-change guard ────────────────────────────────────────────────
            // If a live doc of this format already exists built from the SAME set
            // of source bills, nothing has changed — reuse it instead of creating
            // a duplicate. (Regeneration only makes sense when the sources differ
            // OR the discount changed — the second stage re-enters a discount, so
            // a doc built from the same sources but a different discount is NOT a
            // no-op and must be regenerated.)
            final BigDecimal reqDiscount = req.getDiscount() != null
                    ? req.getDiscount().max(BigDecimal.ZERO) : BigDecimal.ZERO;
            Bill existing = prior.stream()
                    .filter(b -> format.equalsIgnoreCase(b.getBillFormat()))
                    .filter(b -> sourceKey.equals(normalizeIds(b.getConsolidatesBillIds())))
                    .filter(b -> {
                        BigDecimal had = b.getTotalDiscount() != null
                                ? b.getTotalDiscount() : BigDecimal.ZERO;
                        // Compare numerically (ignore scale, e.g. 0 vs 0.00).
                        return had.compareTo(reqDiscount.min(
                                b.getSubtotal() != null ? b.getSubtotal() : reqDiscount)) == 0;
                    })
                    .findFirst()
                    .orElse(null);
            if (existing != null) {
                results.add(toResponse(existing));
                log.info("[BILLING] Reusing unchanged {} doc billNo={} (same sources={})",
                        format, existing.getBillNo(), sourceKey);
                continue;
            }

            Bill doc = buildConsolidatedDoc(sources, req, insurance, format);
            Bill saved = repo.save(doc);
            results.add(toResponse(saved));
            auditLogService.log("Bill", saved.getId(), "CREATE_" + format, currentUser(),
                    "billNo=" + saved.getBillNo() + " sources=" + saved.getConsolidatesBillIds()
                            + " total=" + saved.getTotalAmount() + " (view-only)");
            log.info("[BILLING] Created {} doc billNo={} id={} sources={} total={}",
                    format, saved.getBillNo(), saved.getId(), sources.size(), saved.getTotalAmount());

            // ── Auto create/update ONE insurance claim per admission ──────────
            // When the CONSOLIDATED (Cumulative) doc is generated for an insurance
            // admission, create or refresh the single claim linked to it. The
            // Cumulative is the document emailed to the insurer, so the claim is
            // the source of truth for status + settlement figures from here on.
            // (SUMMARY alone does not drive the claim — the Cumulative does.)
            if (insurance && "CONSOLIDATED".equalsIgnoreCase(format)) {
                try {
                    insuranceClaimService.createOrUpdateForAdmission(
                            saved.getAdmissionId(), saved.getId(), saved.getBillNo(),
                            saved.getPatientId(), saved.getPatientName(), saved.getUhid(),
                            saved.getAdmissionId() != null ? "IP/ADM/" + saved.getAdmissionId() : null,
                            saved.getAdmittedDate(), saved.getDischargeDate(),
                            saved.getInsuranceCompany(), saved.getInsuranceCompanyId(),
                            saved.getPolicyNo(), null, null,
                            saved.getTotalAmount());
                } catch (Exception ex) {
                    // Claim auto-sync is best-effort — the cumulative bill is saved.
                    log.warn("[BILLING] Claim auto-create failed for billNo={}: {}",
                            saved.getBillNo(), ex.getMessage());
                }
            }

            // Supersede only prior docs of the SAME format (snapshot excludes this one).
            for (Bill old : prior) {
                if (!format.equalsIgnoreCase(old.getBillFormat())) continue;
                if (old.getStatus() == BillStatus.CANCELLED) continue;
                old.setStatus(BillStatus.CANCELLED);
                old.setCancellationReason("Superseded by regenerated " + format + " bill " + saved.getBillNo());
                old.setSupersededByBillId(saved.getId());
                repo.save(old);
                auditLogService.log("Bill", old.getId(), "SUPERSEDED", currentUser(),
                        "replacedByBillNo=" + saved.getBillNo());
            }
        }

        return results;
    }

    /** Normalise a CSV of bill IDs to a sorted, order-independent key for comparison. */
    private String normalizeIds(String csv) {
        if (csv == null || csv.isBlank()) return "";
        return java.util.Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .sorted()
                .collect(java.util.stream.Collectors.joining(","));
    }

    /**
     * Build a single view-only consolidated/summary document from the source
     * bills. The money is NOT re-counted: status is CONSOLIDATED (excluded from
     * revenue) and no new PaymentRecords are created — the printed ledger just
     * mirrors the merged payments for display.
     */
    private Bill buildConsolidatedDoc(List<Bill> sources, ConsolidateBillRequest req,
                                      boolean insurance, String format) {
        Bill template = sources.get(0);
        Bill doc = Bill.builder()
                .billNo(generateBillNo(req.getDischargeDate()))
                .date(req.getDischargeDate())
                .patientId(template.getPatientId())
                .patientName(template.getPatientName())
                .uhid(template.getUhid())
                .patientType("IP")
                .age(template.getAge())
                .gender(template.getGender())
                .phone(template.getPhone())
                .doctorName(template.getDoctorName())
                .department(template.getDepartment())
                .ward(template.getWard())
                .bedNumber(template.getBedNumber())
                .admittedDate(template.getAdmittedDate())
                .admittedTime(template.getAdmittedTime())
                .towards("IP_FINAL")
                .admissionId(req.getAdmissionId())
                .consolidated(true)
                .billFormat(format)
                .consolidatesBillIds(sources.stream()
                        .map(b -> String.valueOf(b.getId()))
                        .collect(java.util.stream.Collectors.joining(",")))
                .dischargeDate(req.getDischargeDate())
                .insurance(insurance)
                .insuranceCompany(template.getInsuranceCompany())
                .insuranceCompanyId(template.getInsuranceCompanyId())
                .policyNo(template.getPolicyNo())
                .insuredPersonName(template.getInsuredPersonName())
                .cardNumber(template.getCardNumber())
                // View-only: never carries insurance claim workflow state.
                .insuranceStatus(null)
                // View-only: excluded from revenue totals (see repository sum queries).
                .status(BillStatus.CONSOLIDATED)
                .build();

        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal totalDiscount = BigDecimal.ZERO;
        BigDecimal totalAmount = BigDecimal.ZERO;
        for (Bill src : sources) {
            for (BillItem si : src.getItems()) {
                BillItem copy = BillItem.builder()
                        .bill(doc)
                        .serviceCode(si.getServiceCode())
                        .modalityName(StringUtils.hasText(si.getModalityName())
                                ? si.getModalityName() : "Other")
                        .description(si.getDescription())
                        .quantity(si.getQuantity())
                        .unitPrice(si.getUnitPrice())
                        .discount(si.getDiscount() != null ? si.getDiscount() : BigDecimal.ZERO)
                        .total(si.getTotal())
                        .hospitalRate(si.getHospitalRate())
                        .excluded(si.isExcluded())
                        .tariffNote(si.getTariffNote())
                        .serviceDate(si.getServiceDate())
                        .build();
                doc.getItems().add(copy);
                subtotal = subtotal.add(si.getUnitPrice()
                        .multiply(BigDecimal.valueOf(si.getQuantity())));
                totalDiscount = totalDiscount.add(
                        si.getDiscount() != null ? si.getDiscount() : BigDecimal.ZERO);
                totalAmount = totalAmount.add(si.getTotal());
            }
        }

        // Mirror payments for the printed ledger (display only — not new revenue).
        BigDecimal paidAmount = BigDecimal.ZERO;
        for (Bill src : sources) {
            for (PaymentRecord sp : src.getPayments()) {
                PaymentRecord copy = PaymentRecord.builder()
                        .bill(doc)
                        .date(sp.getDate())
                        .amount(sp.getAmount())
                        .paymentMode(sp.getPaymentMode())
                        .referenceNo(sp.getReferenceNo())
                        .receivedBy(sp.getReceivedBy())
                        .transactionGroupId(sp.getTransactionGroupId())
                        .build();
                doc.getPayments().add(copy);
                paidAmount = paidAmount.add(sp.getAmount() != null ? sp.getAmount() : BigDecimal.ZERO);
            }
        }

        // ── Bill-level discount (entered after the head doctor verifies) ───────
        // When the request carries an overall discount it OVERRIDES the summed
        // per-line discounts (same rule as create()/update()). This drives the
        // Gross → Discount → Bill Amount footer on the Cumulative / Summary bills.
        //   Gross       = subtotal (sum of unitPrice × qty)
        //   Discount    = request discount, clamped to [0, gross]
        //   Bill Amount = Gross − Discount
        // The dated Split-up bill is produced from the raw source bills (not here),
        // so it never carries this discount — exactly the hospital's two-stage flow.
        if (req.getDiscount() != null && req.getDiscount().compareTo(BigDecimal.ZERO) > 0) {
            totalDiscount = req.getDiscount().min(subtotal).max(BigDecimal.ZERO);
            totalAmount   = subtotal.subtract(totalDiscount).max(BigDecimal.ZERO);
        }

        doc.setSubtotal(subtotal);
        doc.setTotalDiscount(totalDiscount);
        doc.setTotalAmount(totalAmount);
        doc.setPaidAmount(paidAmount);
        doc.setDueAmount(totalAmount.subtract(paidAmount).max(BigDecimal.ZERO));
        return doc;
    }

    // ── Update insurance ──────────────────────────────────────────────────────

    public BillResponse updateInsurance(Long id, InsuranceUpdateRequest req) {
        Bill bill = findOrThrow(id);
        if (StringUtils.hasText(req.getInsuranceCompany())) bill.setInsuranceCompany(req.getInsuranceCompany());
        if (StringUtils.hasText(req.getPolicyNo()))         bill.setPolicyNo(req.getPolicyNo());
        if (req.getClaimedAmount() != null)                 bill.setClaimedAmount(req.getClaimedAmount());
        if (req.getInsurancePaidAmount() != null)           bill.setInsurancePaidAmount(req.getInsurancePaidAmount());
        if (req.getInsuranceStatus() != null)               bill.setInsuranceStatus(req.getInsuranceStatus());
        if (StringUtils.hasText(req.getInsuranceRemarks())) bill.setInsuranceRemarks(req.getInsuranceRemarks());

        // ── Finalize to PAID on settlement ────────────────────────────────────
        // When the insurer SETTLES, the bill must become PAID even if the
        // patient already covered the full balance (dueAmount == 0). In that
        // case the settlement payment on /payment is a no-op (nothing left to
        // apply), so the status would otherwise stay PARTIAL forever after
        // close. The insurer's money has now arrived, so finalize the bill
        // entity here: status PAID, due 0, patient-share closed. Idempotent —
        // safe to call multiple times. Never downgrades a non-settled bill.
        if (req.getInsuranceStatus() == InsuranceStatus.SETTLED
                && bill.getStatus() != BillStatus.CANCELLED
                && bill.getStatus() != BillStatus.CONSOLIDATED) {
            bill.setStatus(BillStatus.PAID);
            bill.setDueAmount(BigDecimal.ZERO);
            bill.setPatientShareClosed(true);
        }

        // NOTE: Payment recording is intentionally NOT done here.
        // The insurance page calls /api/bills/{id}/payment explicitly with the settled amount.
        // This endpoint is metadata-only so it is safe to call multiple times without
        // creating duplicate payment records.

        return toResponse(repo.save(bill));
    }


    // ── Search / list ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<BillResponse> search(String search, BillStatus status,
                                     String patientType, Boolean insurance,
                                     LocalDate dateFrom, LocalDate dateTo,
                                     Pageable pageable) {
        return repo.search(
                StringUtils.hasText(search) ? search : null,
                status,
                StringUtils.hasText(patientType) ? patientType : null,
                insurance, dateFrom, dateTo, pageable
        ).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public BillResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    @Transactional(readOnly = true)
    public List<BillResponse> getByPatient(Long patientId) {
        return repo.findByPatientIdOrderByDateDesc(patientId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<BillResponse> getByAdmission(Long admissionId) {
        return repo.findByAdmissionIdOrderByDateDesc(admissionId)
                .stream().map(this::toResponse).toList();
    }

    /**
     * Distinct patient IDs that currently have at least one non-cancelled bill.
     * Lets the patient list render "View Bill" vs "Generate Bill" with a single
     * lightweight request instead of one lookup per patient row.
     */
    @Transactional(readOnly = true)
    public List<Long> getPatientIdsWithBills() {
        return repo.findDistinctPatientIdsWithActiveBills();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /**
     * Auto-resolve admissionId when the caller doesn't supply one. For IP/BOTH
     * patients this links the bill to the patient's currently active admission so
     * it surfaces on the case sheet (which queries bills by admissionId). Without
     * this, bills created from the Bills page — which don't send admissionId — were
     * saved with admission_id = NULL and never appeared under the admission.
     */
    private Long resolveAdmissionId(Long provided, Long patientId, String patientType) {
        if (provided != null) return provided;
        if (patientId == null) return null;
        if (patientType != null
                && !"IP".equalsIgnoreCase(patientType)
                && !"BOTH".equalsIgnoreCase(patientType)) {
            return null;
        }
        return admissionRepo.findActiveByPatientId(patientId)
                .map(Admission::getId)
                .orElse(null);
    }

    /**
     * Resolves the admission ID for the new bill, then blocks creation if an open
     * (PENDING / PARTIAL) IPD bill already exists for that admission.
     *
     * Lab, Pharmacy, and other towards types are intentionally allowed to have
     * multiple open bills per admission — each test visit or pharmacy dispense
     * gets its own bill that is paid immediately at the counter.
     *
     * Only IPD (final ward / discharge) bills are restricted to one open bill at a
     * time, because raising a second IPD bill while the first is unpaid would
     * create double-charging on ward charges.
     */
    private Long resolveAdmission(BillRequest req) {
        Long admissionId = resolveAdmissionId(
                req.getAdmissionId(), req.getPatientId(), req.getPatientType());

        if (admissionId != null
                && req.getTowards() != null
                && "IPD".equalsIgnoreCase(req.getTowards().trim())) {

            List<com.hms.modules.billing.entity.Bill> openIPD =
                    repo.findOpenIPDBillsForAdmission(admissionId);

            if (!openIPD.isEmpty()) {
                String openBillNo = openIPD.get(0).getBillNo();
                throw new com.hms.exception.DuplicateResourceException(
                        "OPEN_IPD_BILL:" + openBillNo
                        + " — An open IPD bill already exists for this admission ("
                        + openBillNo + "). Settle or cancel it before raising a new IPD bill.");
            }
        }

        return admissionId;
    }

    private String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return "system";
        }
        return auth.getPrincipal().toString();
    }

    private String generateBillNo(LocalDate date) {
        String prefix = date.format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        int seq = repo.findMaxBillSeqForDate(prefix) + 1;
        return String.format("BILL-%s-%04d", prefix, seq);
    }

    /**
     * A "main IP bill" is the patient-level inpatient bill for an admission —
     * towards IPD (the counter / running IP bill, incl. the DRAFT that Collect
     * Cash creates) or IP_FINAL (the final consolidated/summary document). Only
     * these are limited to one open bill per admission.
     *
     * Lab / Pharmacy / OPD counter bills return false so they can coexist with
     * the main IP bill and never trip the one-bill-per-admission guard.
     */
    private static boolean isMainIpTowards(String towards) {
        if (towards == null) return false;
        String t = towards.trim();
        return "IPD".equalsIgnoreCase(t) || "IP_FINAL".equalsIgnoreCase(t);
    }

    private Bill findOrThrow(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bill", id));
    }

    private BillResponse toResponse(Bill b) {
        BillResponse r = new BillResponse();
        r.setId(b.getId());
        r.setBillNo(b.getBillNo());
        r.setDate(b.getDate());
        r.setPatientId(b.getPatientId());
        r.setPatientName(b.getPatientName());
        r.setUhid(b.getUhid());
        r.setPatientType(b.getPatientType());
        r.setAge(b.getAge());
        r.setGender(b.getGender());
        r.setPhone(b.getPhone());
        r.setDoctorName(b.getDoctorName());
        r.setDepartment(b.getDepartment());
        r.setWard(b.getWard());
        r.setBedNumber(b.getBedNumber());
        r.setAdmittedDate(b.getAdmittedDate());
        r.setAdmittedTime(b.getAdmittedTime());
        r.setTowards(b.getTowards());
        r.setAdmissionId(b.getAdmissionId());
        r.setVisitId(b.getVisitId());
        r.setSubtotal(b.getSubtotal());
        r.setTotalDiscount(b.getTotalDiscount());
        r.setTotalAmount(b.getTotalAmount());
        r.setPaidAmount(b.getPaidAmount());
        r.setDueAmount(b.getDueAmount());
        r.setInitialCollected(b.getInitialCollected());
        r.setRefundAmount(b.getRefundAmount());
        r.setFree(b.isFree());
        r.setPaymentMode(b.getPaymentMode());
        r.setReferenceNo(b.getReferenceNo());
        r.setStatus(b.getStatus());
        r.setCancellationReason(b.getCancellationReason());
        r.setConsolidated(b.isConsolidated());
        r.setBillFormat(b.getBillFormat());
        r.setConsolidatesBillIds(b.getConsolidatesBillIds());
        r.setSupersededByBillId(b.getSupersededByBillId());
        r.setDischargeDate(b.getDischargeDate());
        r.setInsurance(b.isInsurance());
        r.setInsuranceCompany(b.getInsuranceCompany());
        r.setInsuranceCompanyId(b.getInsuranceCompanyId());
        r.setPolicyNo(b.getPolicyNo());
        r.setInsuredPersonName(b.getInsuredPersonName());
        r.setCardNumber(b.getCardNumber());
        r.setClaimedAmount(b.getClaimedAmount());
        r.setInsurancePaidAmount(b.getInsurancePaidAmount());
        r.setInsuranceStatus(b.getInsuranceStatus());
        r.setInsuranceRemarks(b.getInsuranceRemarks());
        r.setInsuranceTariffApplied(b.isInsuranceTariffApplied());
        r.setInsuranceWriteOff(b.getInsuranceWriteOff());
        r.setInsuranceLocked(b.isInsuranceLocked());
        r.setPatientShareClosed(b.isPatientShareClosed());
        r.setCreatedBy(b.getCreatedBy());
        r.setCreatedAt(b.getCreatedAt());
        r.setUpdatedAt(b.getUpdatedAt());

        r.setItems(b.getItems().stream().map(i -> {
            BillItemResponse ir = new BillItemResponse();
            ir.setId(i.getId());
            ir.setServiceDate(i.getServiceDate());
            ir.setServiceCode(i.getServiceCode());
            ir.setModalityName(i.getModalityName());
            ir.setDescription(i.getDescription());
            ir.setQuantity(i.getQuantity());
            ir.setUnitPrice(i.getUnitPrice());
            ir.setDiscount(i.getDiscount());
            ir.setTotal(i.getTotal());
            ir.setHospitalRate(i.getHospitalRate());
            ir.setExcluded(i.isExcluded());
            ir.setTariffNote(i.getTariffNote());
            return ir;
        }).toList());

        r.setPayments(b.getPayments().stream().map(p -> {
            PaymentRecordResponse pr = new PaymentRecordResponse();
            pr.setId(p.getId());
            pr.setDate(p.getDate());
            pr.setAmount(p.getAmount());
            pr.setPaymentMode(p.getPaymentMode());
            pr.setReferenceNo(p.getReferenceNo());
            pr.setReceivedBy(p.getReceivedBy());
            pr.setCreatedAt(p.getCreatedAt());
            pr.setTransactionGroupId(p.getTransactionGroupId());
            pr.setReceiptType(p.getReceiptType() != null ? p.getReceiptType().name() : null);
            pr.setReceiptNo(p.getReceiptNo());
            pr.setPaymentSplitsJson(p.getPaymentSplitsJson());
            return pr;
        }).toList());

        return r;
    }

    // ── Bill Prefill (Auto-fill from admission) ───────────────────────────────

    @Transactional(readOnly = true)
    public BillPrefillResponse prefill(Long admissionId) {

        Admission adm = admissionRepo.findById(admissionId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Admission", admissionId));

        // ============================================================
        // DATE RANGE
        // ============================================================

        // ── 1. Ward charge segments from transfer log ─────────────────────────

        // Use the hospital's local calendar date (Asia/Kolkata) rather than the raw
        // DB CURDATE(), which can roll a day ahead/behind when the DB server runs in
        // UTC. Using the local date keeps "today" aligned with the admission date
        // staff entered — so a same-day admit-and-bill counts as exactly 1 day.
        LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));

        LocalDate admitDate = adm.getAdmissionDate();

        LocalDate rawEndDate = adm.getDischargeDate() != null
                ? adm.getDischargeDate()
                : today;

        // Never let the billing window end before the admission date (a skewed clock
        // or bad data must not produce negative/zero-length stays). Kept as a separate
        // effectively-final variable because endDate is captured by lambdas below.
        final LocalDate endDate = (admitDate != null && rawEndDate.isBefore(admitDate))
                ? admitDate
                : rawEndDate;


        /*
         * Build admission start date/time.
         *
         * admissionTime is stored as String, for example:
         *
         *     "15:06"
         *
         * or:
         *
         *     "15:06:00"
         *
         * We use LocalTime for reliable comparison.
         */
        LocalDateTime admissionDateTime =
                parseDateTime(admitDate, adm.getAdmissionTime());


        /*
         * Build discharge date/time if the patient is discharged.
         *
         * For an active admission we don't need an end time because
         * billing runs through the current DB date.
         */
        LocalDateTime dischargeDateTime;

        if (adm.getDischargeDate() != null) {
            dischargeDateTime =
                    parseDateTime(
                            adm.getDischargeDate(),
                            adm.getDischargeTime()
                    );
        } else {
            dischargeDateTime = null;
        }


        /*
         * Get ward/bed transfers.
         */
        List<TransferLog> wardTransfers = transferRepo
                .findByAdmissionIdOrderByTransferDateDescTransferTimeDesc(admissionId)
                .stream()
                .filter(t ->
                        t.getTransferType() == TransferType.WARD
                                || t.getTransferType() == TransferType.BED
                )
                .filter(t -> t.getTransferDate() != null)

                /*
                 * VERY IMPORTANT:
                 *
                 * Ignore transfers that happened BEFORE admission.
                 *
                 * Your current data:
                 *
                 * Transfer = 2026-09-12 02:43
                 * Admission = 2026-09-12 15:06
                 *
                 * Therefore this transfer is ignored.
                 */
                .filter(t -> {

                    LocalDateTime transferDateTime =
                            parseDateTime(
                                    t.getTransferDate(),
                                    t.getTransferTime()
                            );

                    return !transferDateTime.isBefore(admissionDateTime);
                })

                /*
                 * If discharged, don't process transfers after discharge.
                 */
                .filter(t -> {

                    if (dischargeDateTime == null) {
                        return true;
                    }

                    LocalDateTime transferDateTime =
                            parseDateTime(
                                    t.getTransferDate(),
                                    t.getTransferTime()
                            );

                    return !transferDateTime.isAfter(dischargeDateTime);
                })

                /*
                 * Build chronological order.
                 */
                .sorted(
                        Comparator
                                .comparing(TransferLog::getTransferDate)
                                .thenComparing(t ->
                                        t.getTransferTime() != null
                                                ? t.getTransferTime()
                                                : ""
                                )
                )
                .toList();


        List<BillPrefillResponse.PrefillItem> items =
                new ArrayList<>();


// ================================================================
// NO VALID TRANSFERS AFTER ADMISSION
// ================================================================

        if (wardTransfers.isEmpty()) {

            /*
             * Patient remained in the admission ward.
             *
             * Example:
             *
             * Admission = Sep 12
             * Today     = Sep 14
             *
             * Result:
             *
             * Day Care Ward
             * Sep 12 -> Sep 14
             * 3 days
             */
            if (!endDate.isBefore(admitDate)) {

                addWardSegmentItem(
                        items,
                        adm.getWardName(),
                        adm.getBedNumber(),
                        adm.getWardId(),
                        admitDate,
                        endDate,
                        wardRepo
                );
            }

        } else {

            // ============================================================
            // START WITH ADMISSION WARD
            // ============================================================

            LocalDate segStart = admitDate;

            String segWard = adm.getWardName();

            String segBed = adm.getBedNumber();

            Long segWardId = adm.getWardId();


            // ============================================================
            // PROCESS TRANSFERS
            // ============================================================

            for (TransferLog t : wardTransfers) {

                LocalDate transferDate = t.getTransferDate();

                if (transferDate == null) {
                    continue;
                }


                /*
                 * Transfer-day rule:
                 *
                 * The OLD ward gets the transfer day.
                 *
                 * Example:
                 *
                 * Sep 12:
                 * Day Care -> General
                 *
                 * Day Care:
                 * Sep 12 -> Sep 12
                 * 1 day
                 *
                 * General:
                 * starts Sep 13
                 */
                LocalDate segEnd = transferDate;


                // ========================================================
                // OLD WARD SEGMENT
                // ========================================================

                if (!segEnd.isBefore(segStart)
                        && !segStart.isAfter(endDate)) {

                    LocalDate actualEnd =
                            segEnd.isAfter(endDate)
                                    ? endDate
                                    : segEnd;


                    addWardSegmentItem(
                            items,
                            segWard,
                            segBed,
                            segWardId,
                            segStart,
                            actualEnd,
                            wardRepo
                    );
                }


                // ========================================================
                // NEW WARD STARTS NEXT DAY
                // ========================================================

                segStart = transferDate.plusDays(1);


                if (segStart.isAfter(endDate)) {
                    break;
                }


                // ========================================================
                // UPDATE WARD/BED
                // ========================================================

                segWard = extractWardName(
                        t.getToValue()
                );

                segBed = extractBedNumber(
                        t.getToValue()
                );


                /*
                 * IMPORTANT:
                 *
                 * This assumes TransferLog.toId is the WARD ID.
                 *
                 * If toId is actually the BED ID, see the note below.
                 */
                segWardId = t.getToId();
            }


            // ============================================================
            // FINAL WARD SEGMENT
            // ============================================================

            if (!segStart.isAfter(endDate)) {

                addWardSegmentItem(
                        items,
                        segWard,
                        segBed,
                        segWardId,
                        segStart,
                        endDate,
                        wardRepo
                );
            }
        }



        // ============================================================
        // 2. UNBILLED LAB TESTS
        // ============================================================

        /*
         * Primary:
         * Labs directly linked to this admission.
         */
        List<LabInvestigation> labsByAdmission =
                labRepo.findByAdmissionIdOrderByOrderedDateDescOrderedTimeDesc(
                        admissionId
                );


        /*
         * Fallback:
         *
         * Labs belonging to this patient during the admission period
         * but where admissionId was not set.
         *
         * This handles older lab records created before the
         * automatic admission linking was implemented.
         */
        List<LabInvestigation> labsByPatient =
                labRepo
                        .findByPatientIdOrderByOrderedDateDescOrderedTimeDesc(
                                adm.getPatientId()
                        )
                        .stream()
                        .filter(l ->
                                l.getAdmissionId() == null
                                        && l.getOrderedDate() != null
                                        && !l.getOrderedDate().isBefore(admitDate)
                                        && !l.getOrderedDate().isAfter(endDate)
                        )
                        .toList();


        // ============================================================
        // MERGE LABS / REMOVE DUPLICATES
        // ============================================================

        Set<Long> seen = new HashSet<>();

        List<LabInvestigation> labs = new ArrayList<>();


        for (LabInvestigation l : labsByAdmission) {

            if (seen.add(l.getId())) {
                labs.add(l);
            }
        }


        for (LabInvestigation l : labsByPatient) {

            if (seen.add(l.getId())) {
                labs.add(l);
            }
        }


        // ============================================================
        // PREVIOUSLY BILLED LABS
        // ============================================================

        List<BillPrefillResponse.PreviouslyBilledLab> prevBilled =
                new ArrayList<>();


        for (LabInvestigation lab : labs) {

            /*
             * Ignore cancelled labs.
             */
            if (lab.getStatus() == LabStatus.CANCELLED) {
                continue;
            }


            /*
             * Ignore labs without a valid price.
             */
            if (lab.getPrice() == null || lab.getPrice() <= 0) {
                continue;
            }


            // ========================================================
            // ALREADY BILLED
            // ========================================================

            if (lab.getBilledInBillId() != null) {

                String billNo =
                        repo.findById(lab.getBilledInBillId())
                                .map(Bill::getBillNo)
                                .orElse(
                                        "BILL-" + lab.getBilledInBillId()
                                );


                BillPrefillResponse.PreviouslyBilledLab prev =
                        new BillPrefillResponse.PreviouslyBilledLab();


                prev.setLabId(lab.getId());

                prev.setLabIdCode(lab.getLabId());

                prev.setInvestigationName(
                        lab.getInvestigationName()
                );

                prev.setPrice(lab.getPrice());

                prev.setBilledInBillNo(billNo);

                prevBilled.add(prev);


            } else {

                // ====================================================
                // UNBILLED LAB
                // ====================================================

                BillPrefillResponse.PrefillItem item =
                        new BillPrefillResponse.PrefillItem();


                // Stamp the lab test code (LAB###) so an insurer tariff row can match this line.
                item.setServiceCode(lab.getTestCode());

                item.setModalityName("Laboratory");

                // Date the test was ordered — printed in the DATE column of the
                // dated split-up bill. Falls back to admission date if missing.
                item.setServiceDate(
                        (lab.getOrderedDate() != null ? lab.getOrderedDate() : admitDate).toString());

                item.setDescription(
                        lab.getInvestigationName()
                                + " (" + lab.getLabId() + ")"
                                + (
                                lab.getStatus() == LabStatus.COMPLETED
                                        ? " \u2713"
                                        : ""
                        )
                );


                item.setQuantity(1);

                item.setUnitPrice(lab.getPrice());

                item.setDiscount(0);

                item.setTotal(lab.getPrice());

                item.setSourceType("LAB_TEST");

                item.setLabId(lab.getId());


                items.add(item);
            }
        }


        // ============================================================
        // BUILD RESPONSE
        // ============================================================

        BillPrefillResponse resp =
                new BillPrefillResponse();


        resp.setAdmissionId(adm.getId());

        resp.setAdmissionNo(adm.getAdmissionNo());

        resp.setPatientId(adm.getPatientId());

        resp.setPatientName(adm.getPatientName());

        resp.setUhid(adm.getUhid());

        resp.setPatientType("IP");

        resp.setAge(adm.getAge());

        resp.setGender(adm.getGender());

        resp.setPhone(adm.getPhone());

        resp.setDoctorName(adm.getAdmittingDoctorName());

        resp.setDepartment(adm.getDepartment());

        resp.setWard(adm.getWardName());

        resp.setBedNumber(adm.getBedNumber());

        resp.setAdmittedDate(admitDate.toString());

        resp.setAdmittedTime(adm.getAdmissionTime());

        // Insurance context — so crafting a bill for a cashless patient auto-loads
        // the insurer / policy / TPA from the admission (not just the patient record).
        resp.setInsuranceCompany(adm.getInsuranceCompany());

        resp.setInsuranceCompanyId(adm.getInsuranceCompanyId());

        resp.setPolicyNo(adm.getPolicyNo());

        resp.setTpaName(adm.getTpaName());

        resp.setPreAuthNumber(adm.getPreAuthNumber());

        resp.setInsuredPersonName(adm.getInsuredPersonName());

        resp.setCardNumber(adm.getCardNumber());

        resp.setInsuranceClaimType(adm.getInsuranceClaimType() != null
                ? adm.getInsuranceClaimType().name() : null);

        resp.setItems(items);

        resp.setPreviouslyBilledLabs(prevBilled);


        return resp;
    }


    /**
     * Adds one ward billing segment.
     *
     * IMPORTANT:
     * from and to are BOTH INCLUSIVE.
     *
     * Examples:
     *
     *     Sep 12 -> Sep 12 = 1 day
     *     Sep 13 -> Sep 14 = 2 days
     *     Sep 12 -> Sep 14 = 3 days
     *
     * Each segment gets its rate from its own wardId.
     */
    private void addWardSegmentItem(
            List<BillPrefillResponse.PrefillItem> items,
            String wardName,
            String bedNumber,
            Long wardId,
            LocalDate from,
            LocalDate to,
            WardRepository wardRepo) {

        if (wardName == null || wardName.isBlank()) {
            return;
        }

        if (from == null || to == null) {
            return;
        }

        if (to.isBefore(from)) {
            return;
        }


        /*
         * INCLUSIVE day calculation.
         *
         * Sep 12 -> Sep 12 = 1
         * Sep 13 -> Sep 14 = 2
         * Sep 12 -> Sep 14 = 3
         */
        long days =
                ChronoUnit.DAYS.between(from, to) + 1;


        double rate = 0.0;
        String wardServiceCode = null;   // WARD-{wardCode} so insurer tariff can match this line


        if (wardId != null) {

            Optional<Ward> ward =
                    wardRepo.findById(wardId);

            rate = ward
                    .map(w ->
                            w.getChargePerDay() != null
                                    ? w.getChargePerDay()
                                    : 0.0
                    )
                    .orElse(0.0);

            wardServiceCode = ward
                    .map(w -> "WARD-" + w.getWardCode())
                    .orElse(null);
        }


        /*
         * Don't add wards that don't have a billable rate.
         */
        if (rate <= 0) {
            return;
        }


        String desc =
                wardName
                        + (
                        bedNumber != null
                                && !bedNumber.isBlank()
                                ? " — Bed " + bedNumber
                                : ""
                )
                        + " ("
                        + days
                        + " day"
                        + (days != 1 ? "s" : "")
                        + ", "
                        + from
                        + " to "
                        + to
                        + ")";


        BillPrefillResponse.PrefillItem item =
                new BillPrefillResponse.PrefillItem();

        // Stamp WARD-{wardCode} so an insurer tariff row for this room can be matched.
        item.setServiceCode(wardServiceCode);

        item.setModalityName("Ward Charges");

        // Segment start date — printed in the DATE column of the dated split-up bill.
        item.setServiceDate(from.toString());

        item.setDescription(desc);

        item.setQuantity((int) days);

        item.setUnitPrice(rate);

        item.setDiscount(0);

        item.setTotal(days * rate);

        item.setSourceType("WARD_CHARGE");

        items.add(item);
    }



    /**
     * Extract ward name from transfer toValue.
     *
     * Example:
     *
     *     "B-05 (General Ward)"
     *
     * returns:
     *
     *     "General Ward"
     */
    private String extractWardName(String toValue) {

        if (toValue == null || toValue.isBlank()) {
            return null;
        }


        int open = toValue.lastIndexOf('(');

        int close = toValue.lastIndexOf(')');


        if (open >= 0 && close > open) {

            return toValue
                    .substring(open + 1, close)
                    .trim();
        }


        return toValue.trim();
    }


    /**
     * Extract bed number from transfer toValue.
     *
     * Example:
     *
     *     "B-05 (General Ward)"
     *
     * returns:
     *
     *     "B-05"
     */
    private String extractBedNumber(String toValue) {

        if (toValue == null || toValue.isBlank()) {
            return null;
        }


        int open = toValue.indexOf('(');


        if (open > 0) {

            return toValue
                    .substring(0, open)
                    .trim();
        }


        return null;
    }

    /**
     * Converts database date + time strings into LocalDateTime.
     *
     * Supports:
     *
     *     "15:06"
     *     "15:06:00"
     *     null
     */
    private LocalDateTime parseDateTime(
            LocalDate date,
            String time) {

        if (date == null) {
            throw new IllegalArgumentException(
                    "Date cannot be null"
            );
        }

        LocalTime localTime;

        if (time == null || time.isBlank()) {

            localTime = LocalTime.MIDNIGHT;

        } else {

            String value = time.trim();

            try {

                /*
                 * HH:mm:ss
                 */
                if (value.length() >= 8) {

                    localTime =
                            LocalTime.parse(
                                    value,
                                    DateTimeFormatter.ofPattern(
                                            "HH:mm:ss"
                                    )
                            );

                } else {

                    /*
                     * HH:mm
                     */
                    localTime =
                            LocalTime.parse(
                                    value,
                                    DateTimeFormatter.ofPattern(
                                            "HH:mm"
                                    )
                            );
                }

            } catch (DateTimeParseException e) {

                throw new IllegalArgumentException(
                        "Invalid time format: " + time
                );
            }
        }

        return LocalDateTime.of(
                date,
                localTime
        );
    }

}
