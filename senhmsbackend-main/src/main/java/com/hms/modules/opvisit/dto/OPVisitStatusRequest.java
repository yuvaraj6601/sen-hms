package com.hms.modules.opvisit.dto;

import com.hms.modules.opvisit.enums.OPVisitStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class OPVisitStatusRequest {

    @NotNull(message = "Status is required")
    private OPVisitStatus status;

    private String billId;  // set when status = BILLED
}
