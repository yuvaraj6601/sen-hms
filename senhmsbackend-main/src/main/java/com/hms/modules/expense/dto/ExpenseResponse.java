package com.hms.modules.expense.dto;

import com.hms.modules.expense.enums.ExpensePaymentMode;
import com.hms.modules.expense.enums.ExpenseStatus;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class ExpenseResponse {
    private Long id;
    private String expenseNo;
    private LocalDate date;
    private String category;
    private String towards;
    private BigDecimal amount;
    private ExpensePaymentMode paymentMode;
    private String referenceNo;
    private String description;
    private String preparedBy;
    private String approvedBy;
    private ExpenseStatus status;
    private String rejectionReason;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
