package com.hms.masters.dto;

import com.hms.masters.enums.DropdownCategory;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class DropdownOptionResponse {

    private Long             id;
    private DropdownCategory category;
    private String           label;
    private Integer          displayOrder;
    private String           status;
    private String           createdBy;
    private LocalDateTime    createdAt;
    private LocalDateTime    updatedAt;
}
