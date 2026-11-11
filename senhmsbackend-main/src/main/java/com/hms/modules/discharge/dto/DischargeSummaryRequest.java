package com.hms.modules.discharge.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class DischargeSummaryRequest {

    @NotNull(message = "admissionId is required")
    private Long admissionId;

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

    private String icuConsultant;
    private String drugAllergy;
    /** Full nested discharge-summary JSON string */
    private String structuredJson;
}
