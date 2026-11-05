package com.hms.modules.dailysummary.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class ManualEntryRequest {

    @NotNull(message = "Date is required")
    private LocalDate entryDate;

    @NotBlank(message = "Patient name is required")
    @Size(max = 150)
    private String patientName;

    @Min(0) @Max(150)
    private Integer age;

    @Size(max = 5)
    private String sex;

    @Size(max = 10)
    private String visitType;

    @NotBlank(message = "Consultant name is required")
    @Size(max = 150)
    private String consultantName;

    @NotBlank(message = "Diagnosis is required")
    @Size(max = 300)
    private String diagnosis;

    @NotBlank(message = "Payment mode is required")
    @Size(max = 15)
    private String paymentMode;

    @NotNull @DecimalMin("0.0")
    private BigDecimal amount;

    /** Optional JSON: [{mode:"Cash",amount:500},{mode:"UPI",amount:300}] */
    private String paymentSplitsJson;

    private String notes;
}
