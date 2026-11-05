package com.hms.modules.billing.entity;

import com.hms.common.BaseEntity;
import com.hms.modules.billing.enums.BillStatus;
import com.hms.modules.billing.enums.InsuranceStatus;
import com.hms.modules.billing.enums.PaymentMode;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "bills")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Bill extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Auto-generated: BILL-YYYYMMDD-XXXX */
    @Column(name = "bill_no", unique = true, nullable = false, length = 25)
    private String billNo;

    @Column(nullable = false)
    private LocalDate date;

    // ── Patient (denormalised) ─────────────────────────────────────────────────

    @Column(name = "patient_id", nullable = false)
    private Long patientId;

    @Column(name = "patient_name", nullable = false, length = 150)
    private String patientName;

    @Column(nullable = false, length = 25)
    private String uhid;

    @Column(name = "patient_type", length = 5)
    private String patientType;   // OP / IP

    private Integer age;

    @Column(length = 10)
    private String gender;

    @Column(length = 20)
    private String phone;

    @Column(name = "doctor_name", length = 150)
    private String doctorName;

    @Column(length = 100)
    private String department;

    // IP-only fields
    @Column(length = 100)
    private String ward;

    @Column(name = "bed_number", length = 20)
    private String bedNumber;

    @Column(name = "admitted_date")
    private LocalDate admittedDate;

    /** Free-form admission time snapshot (e.g. "14:30"), shown on IP / credit bills. */
    @Column(name = "admitted_time", length = 10)
    private String admittedTime;

    /** OPD / IPD / Pharmacy / Lab */
    @Column(length = 50)
    private String towards;

    // ── Line items ────────────────────────────────────────────────────────────

    @OneToMany(mappedBy = "bill", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<BillItem> items = new ArrayList<>();

    // ── Financials ────────────────────────────────────────────────────────────

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(name = "total_discount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalDiscount = BigDecimal.ZERO;

    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "paid_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal paidAmount = BigDecimal.ZERO;

    @Column(name = "due_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal dueAmount = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_mode", length = 15)
    private PaymentMode paymentMode;

    @Column(name = "reference_no", length = 60)
    private String referenceNo;

    // ── Payment records ───────────────────────────────────────────────────────

    @OneToMany(mappedBy = "bill", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<PaymentRecord> payments = new ArrayList<>();

    // ── Status ────────────────────────────────────────────────────────────────

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private BillStatus status = BillStatus.DRAFT;

    @Column(name = "cancellation_reason", columnDefinition = "TEXT")
    private String cancellationReason;

    // ── Insurance ─────────────────────────────────────────────────────────────

    @Column(name = "is_insurance", nullable = false)
    private boolean insurance = false;

    @Column(name = "insurance_company", length = 150)
    private String insuranceCompany;

    @Column(name = "insurance_company_id")
    private Long insuranceCompanyId;

    @Column(name = "policy_no", length = 60)
    private String policyNo;

    /** Name of the insured person on the policy card (prints on the credit bill). */
    @Column(name = "insured_person_name", length = 150)
    private String insuredPersonName;

    /** Insurance card number (prints on the credit bill's Insurance Details block). */
    @Column(name = "card_number", length = 60)
    private String cardNumber;

    @Column(name = "claimed_amount", precision = 12, scale = 2)
    private BigDecimal claimedAmount;

    @Column(name = "insurance_paid_amount", precision = 12, scale = 2)
    private BigDecimal insurancePaidAmount;

    @Enumerated(EnumType.STRING)
    @Column(name = "insurance_status", length = 15)
    private InsuranceStatus insuranceStatus;

    @Column(name = "insurance_remarks", columnDefinition = "TEXT")
    private String insuranceRemarks;

    /**
     * True when this bill was generated at insurer tariff rates (not hospital rates).
     * Set automatically by BillingService when any line item has a tariff price applied.
     */
    @Column(name = "insurance_tariff_applied", nullable = false)
    private boolean insuranceTariffApplied = false;

    /**
     * Gap written off when the hospital locks the bill to the insurer's approved
     * amount (the patient balance was collected in hand, off the system).
     * This is NOT counted as system revenue and does NOT create a PaymentRecord.
     * e.g. bill 20,000, insurer approved 17,500 → writeOff 2,500, bill closes PAID.
     */
    @Column(name = "insurance_write_off", precision = 12, scale = 2)
    private BigDecimal insuranceWriteOff;

    /** True once the bill is locked to the insurer approved amount (admin reopen only). */
    @Column(name = "insurance_locked", nullable = false)
    private boolean insuranceLocked = false;

    /**
     * True when an INSURANCE IP bill has been finalised ("closed") at the point
     * the PATIENT's share is settled (bill total = insurer approved + patient
     * paid), while the insurer's approved amount is still an outstanding
     * receivable (dueAmount) pending the insurer settlement. The bill stays
     * {@link BillStatus#PARTIAL} until the insurer pays (claim → SETTLED records
     * a dated payment that flips it to PAID and books the revenue that day).
     * Such a bill is locked from editing and allows the patient to be discharged.
     */
    @Column(name = "patient_share_closed", nullable = false)
    private boolean patientShareClosed = false;

    // ── Consolidated / Summary IP bill ──────────────────────────────────────────

    /**
     * True when this bill is a consolidated IP bill generated by merging all the
     * individual bills of an admission (ward, lab, doctor fee, dressing, etc.)
     * into one document. Its line items are copies of the source bills' items,
     * grouped by modality. The source bills are marked {@link BillStatus#CONSOLIDATED}.
     */
    @Column(name = "is_consolidated", nullable = false)
    private boolean consolidated = false;

    /**
     * For a consolidated bill, which printed layout it represents:
     *   CONSOLIDATED — fully itemised (qty + rates), carries the real money.
     *   SUMMARY      — modality totals only; a print copy that is EXCLUDED from
     *                  revenue totals so it never double-counts against the
     *                  consolidated bill it mirrors.
     * Null on ordinary (non-consolidated) bills.
     */
    @Column(name = "bill_format", length = 15)
    private String billFormat;

    /**
     * Comma-separated IDs of the source bills merged into this consolidated bill.
     * e.g. "12,15,18". Null on ordinary (non-consolidated) bills.
     */
    @Column(name = "consolidates_bill_ids", length = 500)
    private String consolidatesBillIds;

    /**
     * When a consolidated bill is regenerated, the previous consolidated bill is
     * cancelled and this field on the OLD bill points to the new one that replaced
     * it, keeping a traceable supersede chain. Null unless superseded.
     */
    @Column(name = "superseded_by_bill_id")
    private Long supersededByBillId;

    /**
     * Discharge date entered at generation time, printed on the consolidated /
     * summary bill header. Display-only — it does NOT discharge the admission.
     */
    @Column(name = "discharge_date")
    private LocalDate dischargeDate;

    // ── Audit extras ──────────────────────────────────────────────────────────

    @Column(name = "admission_id")
    private Long admissionId;

    @Column(name = "visit_id")
    private Long visitId;

    // ── OP token advance + free-consultation refund ─────────────────────────────

    /**
     * Money already collected from the patient at OP token time (before the bill
     * was raised), carried onto the bill. Counted into bill-date collection along
     * with any fresh payment, minus {@link #refundAmount}. Zero for bills with no
     * prior token collection.
     */
    @Column(name = "initial_collected", precision = 12, scale = 2)
    private BigDecimal initialCollected = BigDecimal.ZERO;

    /**
     * Cash physically refunded to the patient at bill time — happens when the
     * consultation is waived (free) and the token advance exceeds the net bill.
     * Subtracted from collection so the day's cash reconciles. Zero when nothing
     * is refunded (patient instead pays the shortfall).
     */
    @Column(name = "refund_amount", precision = 12, scale = 2)
    private BigDecimal refundAmount = BigDecimal.ZERO;

    /**
     * True when this bill nets to ₹0 — a fully free visit (consultation waived and
     * no other payable services). Used by the (future) free-consultation report.
     */
    @Column(name = "free", nullable = false)
    private boolean free = false;
}
