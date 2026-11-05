package com.hms.masters.dto;

import com.hms.masters.enums.Status;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ExpenseCategoryResponse {
    private Long id;
    private String categoryCode;
    private String name;
    private String description;
    private Status status;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
