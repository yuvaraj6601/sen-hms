package com.hms.modules.casesheet.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class VitalSignResponse {
    private Long id;
    private Long patientId;
    private String uhid;
    private Long admissionId;
    private Long visitId;
    private LocalDateTime recordedAt;
    private String recordedBy;
    private String bloodPressure;
    private Integer pulse;
    private Double temperature;
    private Double spo2;
    private Integer respiratoryRate;
    private Double weight;
    private Double height;
    private Double bloodGlucose;
    private String notes;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
