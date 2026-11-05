package com.hms.modules.expense.dto;

import com.hms.modules.expense.enums.ExpenseStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ExpenseStatusRequest {

    @NotNull(message = "Status is required")
    private ExpenseStatus status;

    private String approvedBy;
    private String rejectionReason;
}
