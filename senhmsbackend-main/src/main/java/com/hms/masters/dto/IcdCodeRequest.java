package com.hms.masters.dto;

import com.hms.masters.enums.IcdCodeType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class IcdCodeRequest {

    @NotBlank(message = "Complaint is required")
    @Size(max = 200, message = "Complaint must be 200 characters or less")
    private String complaint;

    @NotBlank(message = "ICD code is required")
    @Size(max = 20, message = "ICD code must be 20 characters or less")
    private String icdCode;

    @NotBlank(message = "Description is required")
    @Size(max = 500, message = "Description must be 500 characters or less")
    private String description;

    @NotNull(message = "Code type is required")
    private IcdCodeType codeType;
}
