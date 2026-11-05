package com.hms.masters.dto;

import com.hms.masters.enums.Status;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class BillingModalityResponse {
    private Long id;
    private String modalityCode;
    private String name;
    private String shortName;
    private String description;
    private Status status;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
