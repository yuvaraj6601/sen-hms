package com.hms.modules.admission.dto;

import com.hms.modules.admission.enums.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class AdmissionResponse {

    private Long id;
    private String admissionNo;

    // Patient
    private Long patientId;
    private String uhid;
    private String patientName;
    private Integer age;
    private String gender;
    private String phone;

    // Admission
    private AdmissionType admissionType;
    private LocalDate admissionDate;
    private String admissionTime;
    private String provisionalDiagnosis;
    private ConditionOnAdmission conditionOnAdmission;

    // Doctor / Dept
    private Long admittingDoctorId;
    private String admittingDoctorName;
    private String department;

    // Ward / Bed
    private Long wardId;
    private String wardName;
    private Long bedId;
    private String bedNumber;

    // Referral
    private String referredBy;
    private Long referrerId;

    // Attendant
    private String attendantName;
    private String attendantRelation;
    private String attendantPhone;

    // Insurance
    private String paymentMode;
    @com.fasterxml.jackson.annotation.JsonProperty("isInsurance")
    private boolean isInsurance;
    private InsuranceWorkflowStatus insuranceStatus;
    private String insuranceCompany;
    private Long insuranceCompanyId;
    private String policyNo;
    private String tpaName;
    private String claimNo;
    private String preAuthNumber;
    private String insuredPersonName;
    private String cardNumber;
    private InsuranceClaimType insuranceClaimType;

    // MLC
    private boolean mlc;
    private String mlcNumber;

    // Free / Charity
    private boolean free;

    // Surgical
    private boolean surgical;

    // Status
    private AdmissionStatus status;

    // Discharge (populated when discharged)
    private String dischargeNo;
    private DischargeType dischargeType;
    private LocalDate dischargeDate;
    private String dischargeTime;
    private String dischargingDoctorName;
    private String finalDiagnosis;
    private String proceduresPerformed;
    private ConditionOnDischarge conditionOnDischarge;
    private LocalDate followUpDate;
    private String referredTo;
    private Integer totalDaysStayed;
    private String dischargeNotes;
    private LocalDateTime dischargeInitiatedAt;

    private String notes;

    // ── Admission Order Slip fields ───────────────────────────────────────────
    private String planOfCare;
    private String expectedCost;
    private String expectedOutcome;

    // Transfer history
    private List<TransferLogResponse> transfers;

    // Days stayed so far (computed)
    private Integer daysAdmitted;

    // Audit
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
