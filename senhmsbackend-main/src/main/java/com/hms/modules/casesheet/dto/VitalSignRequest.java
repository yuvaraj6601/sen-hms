package com.hms.modules.casesheet.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class VitalSignRequest {

    @NotNull(message = "Patient ID is required")
    private Long patientId;

    @NotBlank(message = "UHID is required")
    private String uhid;

    private Long admissionId;
    private Long visitId;

    @NotNull(message = "Recorded at datetime is required")
    private LocalDateTime recordedAt;

    @NotBlank(message = "Recorded by is required")
    @Size(max = 150)
    private String recordedBy;

    /** e.g. "120/80" */
    @Size(max = 20)
    private String bloodPressure;

    @Min(0) @Max(300)
    private Integer pulse;

    /** Fahrenheit */
    @DecimalMin("90.0") @DecimalMax("115.0")
    private Double temperature;

    /** Percentage */
    @DecimalMin("50.0") @DecimalMax("100.0")
    private Double spo2;

    @Min(0) @Max(100)
    private Integer respiratoryRate;

    @DecimalMin("0.0")
    private Double weight;

    @DecimalMin("0.0")
    private Double height;

    @DecimalMin("0.0")
    private Double bloodGlucose;

    private String notes;
}
