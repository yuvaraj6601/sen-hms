package com.hms.masters.dto;

import com.hms.masters.enums.Status;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class WardRequest {

    @NotBlank(message = "Ward name is required")
    @Size(max = 100)
    private String name;

    @Size(max = 50)
    private String wardType;

    @NotNull(message = "Department ID is required")
    private Long departmentId;

    @NotNull @Min(1)
    private Integer totalBeds;

    private Double chargePerDay;
    private Status status = Status.ACTIVE;
}
