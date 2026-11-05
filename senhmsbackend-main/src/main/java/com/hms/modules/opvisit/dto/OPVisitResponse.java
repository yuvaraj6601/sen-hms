package com.hms.modules.opvisit.dto;

import com.hms.modules.opvisit.enums.OPVisitStatus;
import com.hms.modules.opvisit.enums.OPVisitType;
import com.hms.modules.opvisit.enums.RegType;
import com.hms.modules.opvisit.enums.RegistrationSource;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class OPVisitResponse {
    private Long id;
    private String visitNo;
    private String tokenNo;
    private String patientId;
    private String uhid;
    private String patientName;
    private Integer age;
    private String gender;
    private String phone;
    private String address;
    private String address1;
    private String address2;
    private String area;
    private String district;
    private String pincode;
    private String state;
    private String maritalStatus;
    private String religion;
    private String bloodGroup;
    private String email;
    private String aadhaarNo;
    private String paymentType;
    private String companyTpa;
    private String doctorId;
    private String doctorName;
    private String department;
    private LocalDate visitDate;
    private String visitTime;
    private OPVisitType type;
    private RegType regType;
    private OPVisitStatus status;
    private String chiefComplaint;
    private String billId;
    private boolean free;
    private java.math.BigDecimal consultationAmount;
    private java.math.BigDecimal discountAmount;
    private java.math.BigDecimal paidAmount;
    private String paymentSplitsJson;
    private String referredBy;
    private RegistrationSource registrationSource;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
