package com.hms.modules.lab.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Body for POST /lab/investigations/orders/{groupId}/estimate.
 * Optional — carries who generated the estimation for the audit trail.
 */
@Data
public class LabEstimateRequest {

    @Size(max = 150)
    private String generatedBy;
}
