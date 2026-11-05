package com.hms.modules.admission.dto;

import com.hms.modules.admission.enums.AdmissionType;
import com.hms.modules.admission.enums.ConditionOnAdmission;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDate;

@Data
public class AdmissionRequest {

    // ── Patient (must exist) ──────────────────────────────────────────────────
    @NotNull(message = "Patient ID is required")
    private Long patientId;

    // ── Admission ─────────────────────────────────────────────────────────────
    @NotNull(message = "Admission type is required")
    private AdmissionType admissionType;

    @NotNull(message = "Admission date is required")
    private LocalDate admissionDate;

    @Size(max = 10)
    private String admissionTime;

    private String provisionalDiagnosis;

    private ConditionOnAdmission conditionOnAdmission;

    // ── Doctor / Department ───────────────────────────────────────────────────
    private Long admittingDoctorId;

    @NotBlank(message = "Admitting doctor name is required")
    @Size(max = 150)
    private String admittingDoctorName;

    @Size(max = 100)
    private String department;

    // ── Ward / Bed ────────────────────────────────────────────────────────────
    @NotNull(message = "Ward is required")
    private Long wardId;

    @NotNull(message = "Bed is required")
    private Long bedId;

    // ── Referral ──────────────────────────────────────────────────────────────
    @Size(max = 150)
    private String referredBy;

    private Long referrerId;

    // ── Attendant ─────────────────────────────────────────────────────────────
    @Size(max = 150)
    private String attendantName;

    @Size(max = 60)
    private String attendantRelation;

    @Size(max = 20)
    private String attendantPhone;

    // ── Insurance ─────────────────────────────────────────────────────────────
    @Size(max = 15)
    private String paymentMode;

    /** Marked as insurance at admit time (details may be filled in later). */
    @com.fasterxml.jackson.annotation.JsonProperty("isInsurance")
    private boolean isInsurance = false;

    /** Optional explicit workflow stage. If null and isInsurance, defaults to DETAILS_INCOMPLETE. */
    private com.hms.modules.admission.enums.InsuranceWorkflowStatus insuranceStatus;

    @Size(max = 150)
    private String insuranceCompany;

    private Long insuranceCompanyId;

    @Size(max = 60)
    private String policyNo;

    @Size(max = 150)
    private String tpaName;

    @Size(max = 60)
    private String claimNo;

    @Size(max = 60)
    private String preAuthNumber;

    @Size(max = 150)
    private String insuredPersonName;

    @Size(max = 60)
    private String cardNumber;

    /** Reimbursement vs cashless. Null = not set. */
    private com.hms.modules.admission.enums.InsuranceClaimType insuranceClaimType;

    // ── MLC ───────────────────────────────────────────────────────────────────
    private boolean mlc = false;

    @Size(max = 40)
    private String mlcNumber;

    // ── Free / Charity ────────────────────────────────────────────────────────
    /** Whether this admission is free of charge (charity / waived). */
    private boolean free = false;

    /** Whether this admission is a surgical case. */
    private boolean surgical = false;

    private String notes;

    // ── Admission Order Slip fields ───────────────────────────────────────────
    private String planOfCare;

    @Size(max = 60)
    private String expectedCost;

    private String expectedOutcome;
}
