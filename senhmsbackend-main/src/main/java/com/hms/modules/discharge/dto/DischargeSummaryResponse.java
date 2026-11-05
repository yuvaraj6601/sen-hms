package com.hms.modules.discharge.dto;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class DischargeSummaryResponse {

    private Long   id;
    private Long   admissionId;
    private String admissionNo;
    private Long   patientId;
    private String uhid;

    // Header
    private String    patientName;
    private String    ageSex;
    private String    ipNo;
    private String    roomNo;
    private String    consultantName;
    private String    insuranceName;
    private String    claimNo;
    private LocalDate dateOfAdmission;
    private String    timeOfAdmission;
    private LocalDate dateOfDischarge;
    private String    timeOfDischarge;

    // Clinical sections
    private String finalDiagnosis;
    private String chiefComplaints;
    private String historyOfPresentIllness;
    private String pastHistory;
    private String clinicalExamination;
    private String investigations;
    private String pulmonaryFunctionTest;
    private String hospitalCourse;
    private String treatmentInHospital;
    private String conditionAtDischarge;
    private String dischargeMedication;
    private String dischargeAdvice;
    private String followUp;
    private String consultantDesignation;

    // Audit
    private String        createdBy;
    private LocalDateTime createdAt;
    private String        updatedBy;
    private LocalDateTime updatedAt;
}
