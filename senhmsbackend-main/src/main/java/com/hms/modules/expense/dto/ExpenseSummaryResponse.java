package com.hms.modules.expense.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
public class ExpenseSummaryResponse {
    private long total;
    private long pending;
    private long approved;
    private long paid;
    private long rejected;
    private BigDecimal totalAmount;
    private BigDecimal paidAmount;
}
