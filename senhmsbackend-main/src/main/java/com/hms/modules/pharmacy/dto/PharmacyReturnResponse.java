package com.hms.modules.pharmacy.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class PharmacyReturnResponse {
    private Long id;
    private Long entryId;
    private LocalDate returnDate;
    private BigDecimal returnAmount;
    private String paymentMode;
    private String notes;
    private LocalDateTime createdAt;
}
