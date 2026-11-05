package com.hms.modules.pharmacy.dto;

import com.hms.modules.pharmacy.enums.PharmacyPaymentMode;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class PharmacyEntryRequest {

    @NotNull(message = "Entry date is required")
    private LocalDate entryDate;

    @NotBlank(message = "Patient name is required")
    @Size(max = 200)
    private String patientName;

    @Size(max = 100)
    private String insuranceName;

    /** Gross value before any discount (full MRP; defaults to totalAmount when not supplied) */
    @DecimalMin(value = "0.00", inclusive = true, message = "Gross amount cannot be negative")
    private BigDecimal grossAmount;

    /**
     * Account total. In the standalone cash-register model there is no fixed
     * medicine total, so this is optional and defaults to the amount collected
     * (handled in the service). Kept for backward compatibility.
     */
    @DecimalMin(value = "0.00", inclusive = true, message = "Total amount cannot be negative")
    private BigDecimal totalAmount;

    private String notes;

    // ── Optional initial advance payment recorded together with the account ────

    /** Advance paid at the time of opening the account (optional, > 0 to record) */
    @DecimalMin(value = "0.00", inclusive = true, message = "Advance amount cannot be negative")
    private BigDecimal advanceAmount;

    /** Payment mode for the initial advance (defaults to CASH when advance > 0) */
    private PharmacyPaymentMode advancePaymentMode;

    /** JSON string for split advance payments — used when advancePaymentMode = MIXED */
    private String advanceSplitsJson;
}
