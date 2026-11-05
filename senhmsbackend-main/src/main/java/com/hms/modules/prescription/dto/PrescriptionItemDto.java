package com.hms.modules.prescription.dto;

import com.hms.modules.casesheet.enums.MedicationRoute;
import com.hms.modules.prescription.enums.PrescriptionTiming;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class PrescriptionItemDto {

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

    private PrescriptionTiming timing;

    @Size(max = 100)
    private String duration;

    private String instructions;
}
