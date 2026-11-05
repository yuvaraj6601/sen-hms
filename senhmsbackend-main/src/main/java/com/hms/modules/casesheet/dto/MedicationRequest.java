package com.hms.modules.casesheet.dto;

import com.hms.modules.casesheet.enums.MedicationRoute;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDate;

@Data
public class MedicationRequest {

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

    @NotBlank(message = "Prescribed by is required")
    @Size(max = 150)
    private String prescribedBy;

    private Long prescribedById;

    @NotBlank(message = "Drug name is required")
    @Size(max = 200)
    private String drugName;

    @NotBlank(message = "Dosage is required")
    @Size(max = 100)
    private String dosage;

    @NotBlank(message = "Frequency is required")
    @Size(max = 100)
    private String frequency;

    private MedicationRoute route = MedicationRoute.ORAL;

    @Size(max = 100)
    private String duration;

    private String instructions;
}
