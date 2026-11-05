package com.hms.modules.insurance.entity;

import com.hms.common.BaseEntity;
import com.hms.modules.insurance.enums.ClaimStatus;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "insurance_claims")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class InsuranceClaim extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Auto-generated: CLM-YYYYMMDD-XXXX */
    @Column(name = "claim_no", unique = true, nullable = false, length = 25)
    private String claimNo;

    // ── Bill link ─────────────────────────────────────────────────────────────
    @Column(name = "bill_id", nullable = false)
    private Long billId;

    @Column(name = "bill_no", nullable = false, length = 25)
    private String billNo;

    // ── Patient ───────────────────────────────────────────────────────────────
    @Column(name = "patient_id", nullable = false)
    private Long patientId;

    @Column(name = "patient_name", nullable = false, length = 150)
    private String patientName;

    @Column(nullable = false, length = 25)
    private String uhid;

    @Column(name = "patient_type", length = 5)
    private String patientType;

    @Column(name = "admission_id")
    private Long admissionId;

    @Column(name = "admission_no", length = 25)
    private String admissionNo;

    @Column(name = "admission_date")
    private LocalDate admissionDate;

    @Column(name = "discharge_date")
    private LocalDate dischargeDate;

    @Column(name = "diagnosis", columnDefinition = "TEXT")
    private String diagnosis;

    // ── Insurance ─────────────────────────────────────────────────────────────
    @Column(name = "insurance_company", nullable = false, length = 150)
    private String insuranceCompany;

    @Column(name = "insurance_company_id")
    private Long insuranceCompanyId;

    @Column(name = "policy_no", length = 60)
    private String policyNo;

    @Column(name = "tpa_name", length = 150)
    private String tpaName;

    @Column(name = "pre_auth_number", length = 60)
    private String preAuthNumber;

    // ── Amounts ───────────────────────────────────────────────────────────────
    @Column(name = "bill_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal billAmount;

    @Column(name = "claimed_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal claimedAmount;

    @Column(name = "approved_amount", precision = 12, scale = 2)
    private BigDecimal approvedAmount;

    @Column(name = "settled_amount", precision = 12, scale = 2)
    private BigDecimal settledAmount;

    /**
     * Authorized Amount — the amount the insurer authorizes, entered from the
     * insurer's email reply. Printed on the credit bill's approval table.
     */
    @Column(name = "authorized_amount", precision = 12, scale = 2)
    private BigDecimal authorizedAmount;

    /**
     * Co-Payment Amount — the patient's co-pay deduction, entered from the
     * insurer's email reply. Printed on the credit bill's approval table.
     * This is ENTERED (not derived) — the insurer sends the exact figure.
     */
    @Column(name = "co_pay_amount", precision = 12, scale = 2)
    private BigDecimal coPayAmount;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;

    // ── Status ────────────────────────────────────────────────────────────────
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ClaimStatus status = ClaimStatus.DETAILS_INCOMPLETE;

    @Column(name = "submitted_date", nullable = false)
    private LocalDate submittedDate;

    @Column(name = "settled_date")
    private LocalDate settledDate;

    @Column(columnDefinition = "TEXT")
    private String remarks;
}
