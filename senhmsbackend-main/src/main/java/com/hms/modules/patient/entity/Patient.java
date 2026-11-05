package com.hms.modules.patient.entity;

import com.hms.common.BaseEntity;
import com.hms.masters.enums.Gender;
import com.hms.modules.patient.enums.BloodGroup;
import com.hms.modules.patient.enums.MaritalStatus;
import com.hms.modules.patient.enums.PatientType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "patients")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Patient extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Unique Hospital ID — format: UHID-YYYYMMDD-XXXXX */
    @Column(unique = true, nullable = false, length = 25)
    private String uhid;

    // ── Personal details ──────────────────────────────────────────────────────

    @Column(nullable = false, length = 150)
    private String name;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    /** Age in years — stored for quick display when DOB is unknown */
    private Integer age;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Gender gender;

    @Enumerated(EnumType.STRING)
    @Column(name = "blood_group", length = 15)
    private BloodGroup bloodGroup;

    @Enumerated(EnumType.STRING)
    @Column(name = "marital_status", length = 15)
    private MaritalStatus maritalStatus;

    @Column(length = 80)
    private String religion;

    @Column(length = 80)
    private String nationality;

    // ── Contact details ───────────────────────────────────────────────────────

    @Column(nullable = false, length = 20)
    private String phone;

    @Column(name = "alternate_phone", length = 20)
    private String alternatePhone;

    @Column(length = 100)
    private String email;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(length = 100)
    private String area;

    @Column(length = 100)
    private String district;

    @Column(length = 100)
    private String state;

    @Column(name = "pin_code", length = 10)
    private String pinCode;

    // ── Medical details ───────────────────────────────────────────────────────

    /** Chief illness / presenting complaint at registration */
    @Column(length = 300)
    private String illness;

    /** Referrer name (free-text denorm for speed) */
    @Column(name = "referred_by", length = 150)
    private String referredBy;

    /** Referrer ID — FK to referrers master */
    @Column(name = "referrer_id")
    private Long referrerId;

    /** Attending doctor name (denorm) */
    @Column(name = "doctor_name", length = 150)
    private String doctorName;

    /** Attending doctor ID — FK to doctors master */
    @Column(name = "doctor_id")
    private Long doctorId;

    /** Department name (denorm) */
    @Column(length = 100)
    private String department;

    @Enumerated(EnumType.STRING)
    @Column(name = "patient_type", nullable = false, length = 10)
    private PatientType patientType = PatientType.OP;

    // ── Insurance details (optional) ──────────────────────────────────────────

    @Column(name = "insurance_company", length = 150)
    private String insuranceCompany;

    @Column(name = "insurance_company_id")
    private Long insuranceCompanyId;

    @Column(name = "policy_no", length = 60)
    private String policyNo;

    @Column(name = "tpa_name", length = 150)
    private String tpaName;

    // ── Emergency contact ─────────────────────────────────────────────────────

    @Column(name = "attendant_name", length = 150)
    private String attendantName;

    @Column(name = "attendant_relation", length = 60)
    private String attendantRelation;

    @Column(name = "attendant_phone", length = 20)
    private String attendantPhone;

    // ── Misc ──────────────────────────────────────────────────────────────────

    @Column(name = "id_proof_type", length = 50)
    private String idProofType;

    @Column(name = "id_proof_no", length = 60)
    private String idProofNo;

    @Column(columnDefinition = "TEXT")
    private String notes;

    /** Whether the patient record is active (soft-delete) */
    @Column(nullable = false)
    private boolean active = true;

    /**
     * Free / charity patient flag.
     * When true: bill settlement check is bypassed for both OP and IP discharge.
     * Visible in UI with a "Free" badge and tracked in dashboard stats.
     */
    @Column(name = "free_patient", nullable = false)
    private boolean freePatient = false;

    /**
     * Whether the one-time post-admission demographic correction has been used.
     * Demographic edits are unlimited while the patient has no active admission.
     * Once an active admission exists, the patient entity may be corrected
     * exactly ONCE (regardless of the admit path) — this flag flips true on that
     * edit and blocks any further post-admission demographic change. Admission-
     * level corrections continue through the Admission edit flow.
     */
    @Column(name = "post_admit_edited", nullable = false, columnDefinition = "boolean default false")
    private boolean postAdmitEdited = false;
}
