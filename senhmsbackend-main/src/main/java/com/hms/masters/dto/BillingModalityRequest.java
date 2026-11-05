package com.hms.masters.dto;

import com.hms.masters.enums.Status;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class BillingModalityRequest {

    @NotBlank(message = "Name is required")
    @Size(max = 100)
    private String name;

    @NotBlank(message = "Short name is required")
    @Size(max = 20)
    private String shortName;

    private String description;
    private Status status = Status.ACTIVE;
}
