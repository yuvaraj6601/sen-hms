package com.hms.masters.dto;

import com.hms.masters.enums.Status;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class ExpenseCategoryRequest {

    @NotBlank(message = "Name is required")
    @Size(max = 100)
    private String name;

    private String description;
    private Status status = Status.ACTIVE;
}
