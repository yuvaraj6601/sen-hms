package com.hms.modules.admission.dto;

import com.hms.modules.admission.enums.AdmissionStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AdmissionStatusRequest {

    @NotNull(message = "Status is required")
    private AdmissionStatus status;

    private String notes;
}
