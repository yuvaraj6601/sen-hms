package com.hms.masters.dto;

import com.hms.masters.enums.DepartmentType;
import com.hms.masters.enums.Status;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class DepartmentResponse {
    private Long id;
    private String deptCode;
    private String name;
    private String shortName;
    private DepartmentType type;
    private boolean hasWards;
    private Integer totalBeds;
    private Integer occupiedBeds;
    private String floor;
    private String headName;
    private String phone;
    private Status status;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
