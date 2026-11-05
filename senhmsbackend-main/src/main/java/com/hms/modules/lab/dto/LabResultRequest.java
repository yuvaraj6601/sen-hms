package com.hms.modules.lab.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class LabResultRequest {

    /**
     * Single result value for simple tests. For multi-parameter tests this may
     * be left blank and {@link #parameterResults} supplied instead. The service
     * enforces that at least one of the two is present.
     */
    private String result;

    /**
     * JSON array of structured per-parameter results for multi-parameter tests.
     * Each element: { group, subGroup, name, value, unit, normalRange, abnormal }
     */
    private String parameterResults;

    @NotBlank(message = "Completed by is required")
    @Size(max = 150)
    private String completedBy;
}
