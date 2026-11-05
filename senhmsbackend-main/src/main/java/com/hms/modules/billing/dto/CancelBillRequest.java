package com.hms.modules.billing.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CancelBillRequest {

    @NotBlank(message = "Cancellation reason is required")
    private String reason;
}
