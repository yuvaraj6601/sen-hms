package com.hms.modules.casesheet.dto;

import com.hms.modules.casesheet.enums.MedicationRoute;
import com.hms.modules.casesheet.enums.MedicationStatus;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class MedicationResponse {
    private Long id;
    private Long patientId;
    private String uhid;
    private Long admissionId;
    private Long visitId;
    private LocalDate date;
    private String time;
    private String prescribedBy;
    private Long prescribedById;
    private String drugName;
    private String dosage;
    private String frequency;
    private MedicationRoute route;
    private String duration;
    private String instructions;
    private MedicationStatus status;
    private LocalDate stoppedOn;
    private String stoppedReason;
    private String stoppedBy;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
