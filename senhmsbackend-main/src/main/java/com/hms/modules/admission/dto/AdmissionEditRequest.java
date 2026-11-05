package com.hms.modules.admission.dto;

import com.hms.modules.admission.enums.AdmissionType;
import com.hms.modules.admission.enums.ConditionOnAdmission;
import com.hms.modules.admission.enums.InsuranceClaimType;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

/**
 * Editable admission fields (post-admission edit).
 *
 * Excludes patient / bed / ward / status / discharge — those are managed by
 * dedicated flows (admit, transfer, updateStatus, discharge).
 */
@Data
public class AdmissionEditRequest {

    /**
     * Editable patient name snapshot for THIS admission (used on bills /
     * insurance). The master Patient record's name is NOT changed here —
     * e.g. an urgent admission captured only "Ravi" can be corrected to the
     * full legal name "Ravi Kumar" for the insurance claim. Blank = leave as-is.
     */
    @Size(max = 150)
    private String patientName;

    private AdmissionType admissionType;
    private LocalDate admissionDate;
    @Size(max = 10)
    private String admissionTime;

    private String provisionalDiagnosis;
    private ConditionOnAdmission conditionOnAdmission;

    private Long admittingDoctorId;
    @Size(max = 150)
    private String admittingDoctorName;
    @Size(max = 100)
    private String department;

    @Size(max = 150)
    private String referredBy;
    private Long referrerId;

    @Size(max = 150)
    private String attendantName;
    @Size(max = 60)
    private String attendantRelation;
    @Size(max = 20)
    private String attendantPhone;

    @Size(max = 15)
    private String paymentMode;

    /** Marked as insurance patient. */
    @com.fasterxml.jackson.annotation.JsonProperty("isInsurance")
    private boolean isInsurance = false;

    /** Insurance workflow stage (advanced by the coordinator as the case progresses). */
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
    private InsuranceClaimType insuranceClaimType;

    private boolean mlc = false;
    @Size(max = 40)
    private String mlcNumber;

    /** Free / charity admission. */
    private boolean free = false;
    /** Surgical case. */
    private boolean surgical = false;

    private String notes;
    private String planOfCare;
    @Size(max = 60)
    private String expectedCost;
    private String expectedOutcome;
}
