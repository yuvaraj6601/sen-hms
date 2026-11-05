package com.hms.modules.billing.dto;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class BillItemResponse {
    private Long id;
    /** Date this service was rendered — shown per line on the split-up bill. */
    private LocalDate serviceDate;
    private String serviceCode;
    private String modalityName;
    private String description;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal discount;
    private BigDecimal total;

    // ── Insurance tariff fields ───────────────────────────────────────────────
    /** Hospital's standard rate — null for cash patients */
    private BigDecimal hospitalRate;
    /** True = insurer does not cover this service */
    private boolean excluded;
    /** Note from the tariff entry, if any */
    private String tariffNote;
}
