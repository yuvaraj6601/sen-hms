package com.hms.modules.casesheet.dto;

import com.hms.modules.casesheet.enums.ObservationType;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDate;

@Data
public class ObservationRequest {

    @NotNull(message = "Patient ID is required")
    private Long patientId;

    @NotBlank(message = "UHID is required")
    private String uhid;

    private Long admissionId;
    private Long visitId;

    @NotNull(message = "Date is required")
    private LocalDate date;

    @NotBlank(message = "Time is required")
    @Size(max = 10)
    private String time;

    @NotBlank(message = "Doctor name is required")
    @Size(max = 150)
    private String doctorName;

    private Long doctorId;

    private ObservationType type = ObservationType.ROUND;

    @NotBlank(message = "Chief complaint is required")
    private String chiefComplaint;

    private String clinicalFindings;

    @NotBlank(message = "Diagnosis is required")
    private String diagnosis;

    private String plan;
    private String notes;
}
