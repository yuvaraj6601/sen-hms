package com.hms.modules.billing.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class BillItemRequest {

    @Size(max = 20)
    private String serviceCode;

    @Size(max = 100)
    private String modalityName;

    /** Date this service was rendered (ward day, OT, lab test etc). Null = no specific date. */
    private LocalDate serviceDate;

    @NotBlank(message = "Description is required")
    private String description;

    @NotNull @Min(1)
    private Integer quantity = 1;

    @NotNull(message = "Unit price is required")
    @DecimalMin("0.0")
    private BigDecimal unitPrice;

    @DecimalMin("0.0")
    private BigDecimal discount = BigDecimal.ZERO;

    /** Optional: ID of the lab investigation this item was generated from (prefill).
     *  Used to mark the lab as billed when the bill is saved. */
    private Long labId;

    // ── Insurance tariff fields ───────────────────────────────────────────────

    /**
     * Hospital's standard rate from BillingMaster.
     * Null for cash patients. Populated for insurance patients so the
     * difference is visible in reports and on the bill.
     */
    @DecimalMin("0.0")
    private BigDecimal hospitalRate;

    /**
     * True when the insurer does not cover this service.
     * unitPrice will be 0 and the line is flagged "Not Covered".
     */
    private boolean excluded = false;

    /**
     * Optional note from InsuranceTariff.notes, carried onto the bill line.
     */
    @Size(max = 255)
    private String tariffNote;
}
