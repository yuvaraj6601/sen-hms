package com.hms.masters.dto;

import com.hms.masters.enums.Status;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class BillingMasterRequest {

    @NotBlank(message = "Service name is required")
    @Size(max = 150)
    private String serviceName;

    @NotNull(message = "Modality ID is required")
    private Long modalityId;

    @NotNull(message = "Price is required")
    @DecimalMin(value = "0.0", inclusive = false)
    private BigDecimal price;

    private boolean discountAllowed = false;
    private boolean showInOp = true;
    private Status status = Status.ACTIVE;
}
