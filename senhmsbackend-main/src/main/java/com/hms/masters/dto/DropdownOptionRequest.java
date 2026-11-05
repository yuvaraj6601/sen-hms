package com.hms.masters.dto;

import com.hms.masters.enums.DropdownCategory;
import com.hms.masters.enums.Status;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class DropdownOptionRequest {

    @NotNull(message = "Category is required")
    private DropdownCategory category;

    @NotBlank(message = "Value is required")
    @Size(max = 150, message = "Value must be 150 characters or less")
    private String label;

    private Integer displayOrder;

    private Status status = Status.ACTIVE;
}
