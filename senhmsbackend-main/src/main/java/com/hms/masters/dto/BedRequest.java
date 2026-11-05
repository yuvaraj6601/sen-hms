package com.hms.masters.dto;

import com.hms.masters.entity.Bed.BedStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class BedRequest {

    @NotBlank(message = "Bed number is required")
    @Size(max = 20)
    private String number;

    @NotNull(message = "Ward ID is required")
    private Long wardId;

    private BedStatus status = BedStatus.AVAILABLE;
}
