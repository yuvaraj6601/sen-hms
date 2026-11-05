package com.hms.modules.patient.dto;

import com.hms.masters.enums.Gender;
import com.hms.modules.patient.enums.BloodGroup;
import com.hms.modules.patient.enums.MaritalStatus;
import com.hms.modules.patient.enums.PatientType;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class PatientResponse {

    private Long id;
    private String uhid;

    // Personal
    private String name;
    private LocalDate dateOfBirth;
    private Integer age;
    private Gender gender;
    private BloodGroup bloodGroup;
    private MaritalStatus maritalStatus;
    private String religion;
    private String nationality;

    // Contact
    private String phone;
    private String alternatePhone;
    private String email;
    private String address;
    private String area;
    private String district;
    private String state;
    private String pinCode;

    // Medical
    private String illness;
    private String referredBy;
    private Long referrerId;
    private String doctorName;
    private Long doctorId;
    private String department;
    private PatientType patientType;

    // Insurance
    private String insuranceCompany;
    private Long insuranceCompanyId;
    private String policyNo;
    private String tpaName;

    // Emergency contact
    private String attendantName;
    private String attendantRelation;
    private String attendantPhone;

    // ID proof
    private String idProofType;
    private String idProofNo;

    private String notes;
    private boolean active;
    private boolean freePatient;
    /** True once the one-time post-admission demographic correction has been used. */
    private boolean postAdmitEdited;

    // Audit
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
