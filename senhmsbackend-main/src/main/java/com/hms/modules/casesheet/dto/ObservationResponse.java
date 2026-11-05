package com.hms.modules.casesheet.dto;

import com.hms.modules.casesheet.enums.ObservationType;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class ObservationResponse {
    private Long id;
    private Long patientId;
    private String uhid;
    private Long admissionId;
    private Long visitId;
    private LocalDate date;
    private String time;
    private String doctorName;
    private Long doctorId;
    private ObservationType type;
    private String chiefComplaint;
    private String clinicalFindings;
    private String diagnosis;
    private String plan;
    private String notes;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
