package com.hms.modules.admission.dto;

import com.hms.modules.admission.enums.TransferType;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDate;

@Data
public class TransferRequest {

    @NotNull(message = "Transfer type is required")
    private TransferType transferType;

    @NotBlank(message = "From value is required")
    @Size(max = 200)
    private String fromValue;

    @NotBlank(message = "To value is required")
    @Size(max = 200)
    private String toValue;

    /** DB id of the destination (ward/bed/doctor/department) — used to update admission record */
    private Long toId;

    @NotNull(message = "Transfer date is required")
    private LocalDate transferDate;

    @Size(max = 10)
    private String transferTime;

    @NotBlank(message = "Reason is required")
    private String reason;

    @Size(max = 150)
    private String orderedBy;

    @Size(max = 150)
    private String doneBy;

    private String notes;
}
