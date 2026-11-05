package com.hms.modules.patient.dto;

import com.hms.masters.enums.Gender;
import com.hms.modules.patient.enums.BloodGroup;
import com.hms.modules.patient.enums.MaritalStatus;
import com.hms.modules.patient.enums.PatientType;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDate;

@Data
public class PatientRequest {

    // ── Personal ──────────────────────────────────────────────────────────────

    @NotBlank(message = "Patient name is required")
    @Size(max = 150)
    private String name;

    private LocalDate dateOfBirth;

    @Min(0) @Max(150)
    private Integer age;

    @NotNull(message = "Gender is required")
    private Gender gender;

    private BloodGroup bloodGroup;

    private MaritalStatus maritalStatus;

    @Size(max = 80)
    private String religion;

    @Size(max = 80)
    private String nationality;

    // ── Contact ───────────────────────────────────────────────────────────────

    @NotBlank(message = "Phone number is required")
    @Size(max = 20)
    private String phone;

    @Size(max = 20)
    private String alternatePhone;

    @Email
    @Size(max = 100)
    private String email;

    private String address;

    @Size(max = 100)
    private String area;

    @Size(max = 100)
    private String district;

    @Size(max = 100)
    private String state;

    @Size(max = 10)
    private String pinCode;

    // ── Medical ───────────────────────────────────────────────────────────────

    @Size(max = 300)
    private String illness;

    @Size(max = 150)
    private String referredBy;

    private Long referrerId;

    @Size(max = 150)
    private String doctorName;

    private Long doctorId;

    @Size(max = 100)
    private String department;

    private PatientType patientType = PatientType.OP;

    // ── Insurance ─────────────────────────────────────────────────────────────

    @Size(max = 150)
    private String insuranceCompany;

    private Long insuranceCompanyId;

    @Size(max = 60)
    private String policyNo;

    @Size(max = 150)
    private String tpaName;

    // ── Emergency contact ─────────────────────────────────────────────────────

    @Size(max = 150)
    private String attendantName;

    @Size(max = 60)
    private String attendantRelation;

    @Size(max = 20)
    private String attendantPhone;

    // ── ID Proof ──────────────────────────────────────────────────────────────

    @Size(max = 50)
    private String idProofType;

    @Size(max = 60)
    private String idProofNo;

    private String notes;

    // ── Admission pass-through flags (NOT stored on Patient) ───────────────────
    // free / surgical / mlc are per-admission facts and live on the Admission
    // entity. They are relayed here so the single Edit action can update the
    // patient AND the patient's active admission in one transaction.
    // When null, the corresponding admission field is left unchanged.
    private Boolean free;
    private Boolean surgical;
    private Boolean mlc;
    private String mlcNumber;
}
