package com.hms.modules.pharmacy.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class PharmacyPaymentResponse {
    private Long id;
    private Long entryId;
    private LocalDate paymentDate;
    private BigDecimal amount;
    private String paymentMode;
    private String paymentSplitsJson;
    private boolean advance;
    private String notes;
    private LocalDateTime createdAt;
}
