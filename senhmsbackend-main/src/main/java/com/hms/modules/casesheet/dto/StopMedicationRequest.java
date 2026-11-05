package com.hms.modules.casesheet.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class StopMedicationRequest {

    @NotBlank(message = "Reason for stopping is required")
    private String reason;

    @Size(max = 150)
    private String stoppedBy;
}
