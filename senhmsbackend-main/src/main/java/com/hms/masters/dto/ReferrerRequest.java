package com.hms.masters.dto;

import com.hms.masters.enums.ReferrerType;
import com.hms.masters.enums.Status;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class ReferrerRequest {

    @NotBlank(message = "Name is required")
    @Size(max = 150)
    private String name;

    @NotNull(message = "Type is required")
    private ReferrerType type;

    @Size(max = 100)
    private String specialization;

    @Size(max = 150)
    private String organization;

    @Size(max = 20)
    private String phone;

    @Size(max = 20)
    private String alternatePhone;

    private String address;
    private String notes;
    private Status status = Status.ACTIVE;
}
