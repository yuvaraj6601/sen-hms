package com.hms.masters.dto;

import com.hms.masters.enums.DepartmentType;
import com.hms.masters.enums.Status;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class DepartmentRequest {

    @NotBlank(message = "Department name is required")
    @Size(max = 100)
    private String name;

    @NotBlank(message = "Short name is required")
    @Size(max = 20)
    private String shortName;

    @NotNull(message = "Department type is required")
    private DepartmentType type;

    private boolean hasWards = false;
    private Integer totalBeds;
    private String floor;
    private String headName;
    private String phone;
    private Status status = Status.ACTIVE;
}
