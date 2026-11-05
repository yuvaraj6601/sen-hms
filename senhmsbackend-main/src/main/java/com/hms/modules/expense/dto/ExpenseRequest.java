package com.hms.modules.expense.dto;

import com.hms.modules.expense.enums.ExpensePaymentMode;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class ExpenseRequest {

    @NotNull(message = "Date is required")
    private LocalDate date;

    @NotBlank(message = "Category is required")
    @Size(max = 100)
    private String category;

    @NotBlank(message = "Towards is required")
    @Size(max = 200)
    private String towards;

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.01", message = "Amount must be greater than 0")
    private BigDecimal amount;

    @NotNull(message = "Payment mode is required")
    private ExpensePaymentMode paymentMode;

    @Size(max = 50)
    private String referenceNo;

    @NotBlank(message = "Description is required")
    private String description;

    @NotBlank(message = "Prepared by is required")
    @Size(max = 100)
    private String preparedBy;

    /** Role of the submitter — used to auto-approve for Admin / Managing Director */
    private String submittedByRole;
}
