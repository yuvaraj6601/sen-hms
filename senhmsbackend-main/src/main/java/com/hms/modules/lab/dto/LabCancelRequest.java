package com.hms.modules.lab.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LabCancelRequest {

    @NotBlank(message = "Cancel reason is required")
    private String reason;
}
