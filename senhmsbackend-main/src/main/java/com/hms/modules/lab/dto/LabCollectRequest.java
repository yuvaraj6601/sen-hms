package com.hms.modules.lab.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class LabCollectRequest {

    @NotBlank(message = "Collected by is required")
    @Size(max = 150)
    private String collectedBy;
}
