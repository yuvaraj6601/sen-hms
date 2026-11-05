package com.hms.modules.admission.entity;

import com.hms.common.BaseEntity;
import com.hms.modules.admission.enums.*;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "admissions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Admission extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Unique admission number — format: ADM-YYYYMMDD-XXXX */
    @Column(name = "admission_no", unique = true, nullable = false, length = 25)
    private String admissionNo;

    // ── Patient info (denormalised for speed) ─────────────────────────────────

    @Column(name = "patient_id", nullable = false)
    private Long patientId;

    @Column(nullable = false, length = 25)
    private String uhid;

    @Column(name = "patient_name", nullable = false, length = 150)
    private String patientName;

    private Integer age;

    @Column(length = 10)
    private String gender;

    @Column(length = 20)
    private String phone;

    // ── Admission details ─────────────────────────────────────────────────────

    @Enumerated(EnumType.STRING)
    @Column(name = "admission_type", nullable = false, length = 50)
    private AdmissionType admissionType;

    @Column(name = "admission_date", nullable = false)
    private LocalDate admissionDate;

    @Column(name = "admission_time", length = 10)
    private String admissionTime;

    @Column(name = "provisional_diagnosis", columnDefinition = "TEXT")
    private String provisionalDiagnosis;

    @Enumerated(EnumType.STRING)
    @Column(name = "condition_on_admission", length = 20)
    private ConditionOnAdmission conditionOnAdmission;

    // ── Doctor / Department ───────────────────────────────────────────────────

    @Column(name = "admitting_doctor_id")
    private Long admittingDoctorId;

    @Column(name = "admitting_doctor_name", nullable = false, length = 150)
    private String admittingDoctorName;

    @Column(length = 100)
    private String department;

    // ── Ward / Bed ────────────────────────────────────────────────────────────

    @Column(name = "ward_id")
    private Long wardId;

    @Column(name = "ward_name", length = 100)
    private String wardName;

    @Column(name = "bed_id")
    private Long bedId;

    @Column(name = "bed_number", length = 20)
    private String bedNumber;

    // ── Referral ──────────────────────────────────────────────────────────────

    @Column(name = "referred_by", length = 150)
    private String referredBy;

    @Column(name = "referrer_id")
    private Long referrerId;

    // ── Attendant / Emergency contact ─────────────────────────────────────────

    @Column(name = "attendant_name", length = 150)
    private String attendantName;

    @Column(name = "attendant_relation", length = 60)
    private String attendantRelation;

    @Column(name = "attendant_phone", length = 20)
    private String attendantPhone;

    // ── Insurance ─────────────────────────────────────────────────────────────

    @Column(name = "payment_mode", length = 15)
    private String paymentMode;

    /**
     * Marked as an insurance patient at admit time. The detailed insurance
     * fields (company / policy / TPA / claim no) may be filled in later, so this
     * flag is the authoritative "is this an insurance case" signal that drives
     * the insurance workflow status and the patient-list Insurance column.
     */
    @Column(name = "is_insurance", nullable = false)
    private boolean isInsurance = false;

    /**
     * Insurance workflow stage. Defaults to DETAILS_INCOMPLETE when a patient is
     * marked insurance at admission. Null when not an insurance case.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "insurance_status", length = 25)
    private InsuranceWorkflowStatus insuranceStatus;

    @Column(name = "insurance_company", length = 150)
    private String insuranceCompany;

    @Column(name = "insurance_company_id")
    private Long insuranceCompanyId;

    @Column(name = "policy_no", length = 60)
    private String policyNo;

    @Column(name = "tpa_name", length = 150)
    private String tpaName;

    @Column(name = "claim_no", length = 60)
    private String claimNo;

    @Column(name = "pre_auth_number", length = 60)
    private String preAuthNumber;

    /** Name of the insured person on the policy card (may differ from the patient). */
    @Column(name = "insured_person_name", length = 150)
    private String insuredPersonName;

    /** Insurance card number printed on the credit bill's Insurance Details block. */
    @Column(name = "card_number", length = 60)
    private String cardNumber;

    /** Reimbursement vs cashless/direct claim. Null when not an insurance admission. */
    @Enumerated(EnumType.STRING)
    @Column(name = "insurance_claim_type", length = 15)
    private InsuranceClaimType insuranceClaimType;

    // ── MLC ───────────────────────────────────────────────────────────────────

    @Column(nullable = false)
    private boolean mlc = false;

    @Column(name = "mlc_number", length = 40)
    private String mlcNumber;

    // ── Free / Charity ────────────────────────────────────────────────────────

    /** Whether this admission was provided free of charge (charity / waived). Per-admission fact. */
    @Column(name = "free", nullable = false)
    private boolean free = false;

    /** Whether this admission is a surgical case. Per-admission fact. */
    @Column(name = "surgical", nullable = false)
    private boolean surgical = false;

    // ── Status ────────────────────────────────────────────────────────────────

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 25)
    private AdmissionStatus status = AdmissionStatus.ADMITTED;

    // ── Discharge (populated on discharge) ───────────────────────────────────

    @Column(name = "discharge_no", unique = true, length = 25)
    private String dischargeNo;

    @Enumerated(EnumType.STRING)
    @Column(name = "discharge_type", length = 15)
    private DischargeType dischargeType;

    @Column(name = "discharge_date")
    private LocalDate dischargeDate;

    @Column(name = "discharge_time", length = 10)
    private String dischargeTime;

    @Column(name = "discharging_doctor_name", length = 150)
    private String dischargingDoctorName;

    @Column(name = "final_diagnosis", columnDefinition = "TEXT")
    private String finalDiagnosis;

    @Column(name = "procedures_performed", columnDefinition = "TEXT")
    private String proceduresPerformed;   // comma-separated

    @Enumerated(EnumType.STRING)
    @Column(name = "condition_on_discharge", length = 15)
    private ConditionOnDischarge conditionOnDischarge;

    @Column(name = "follow_up_date")
    private LocalDate followUpDate;

    @Column(name = "referred_to", length = 200)
    private String referredTo;

    @Column(name = "total_days_stayed")
    private Integer totalDaysStayed;

    @Column(name = "discharge_notes", columnDefinition = "TEXT")
    private String dischargeNotes;

    @Column(name = "discharge_initiated_at")
    private LocalDateTime dischargeInitiatedAt;

    // ── Notes ─────────────────────────────────────────────────────────────────

    @Column(columnDefinition = "TEXT")
    private String notes;

    // ── Admission Order Slip fields ───────────────────────────────────────────

    @Column(name = "plan_of_care", columnDefinition = "TEXT")
    private String planOfCare;

    @Column(name = "expected_cost", length = 60)
    private String expectedCost;

    @Column(name = "expected_outcome", columnDefinition = "TEXT")
    private String expectedOutcome;
}
