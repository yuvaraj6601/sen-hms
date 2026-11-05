package com.hms.modules.billing.dto;

import com.hms.modules.billing.enums.PaymentMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
public class BillRequest {

    // ── Patient ───────────────────────────────────────────────────────────────
    @NotNull(message = "Patient ID is required")
    private Long patientId;

    @NotBlank @Size(max = 25)
    private String uhid;

    @NotBlank @Size(max = 150)
    private String patientName;

    @Size(max = 5)
    private String patientType;

    private Integer age;

    @Size(max = 10)
    private String gender;

    @Size(max = 20)
    private String phone;

    @Size(max = 150)
    private String doctorName;

    @Size(max = 100)
    private String department;

    @Size(max = 100)
    private String ward;

    @Size(max = 20)
    private String bedNumber;

    private LocalDate admittedDate;

    @Size(max = 10)
    private String admittedTime;

    /** Discharge date (IP/BOTH) — display-only, printed on the bill; does NOT discharge the admission. */
    private LocalDate dischargeDate;

    @Size(max = 50)
    private String towards;

    // ── Links ─────────────────────────────────────────────────────────────────
    private Long admissionId;
    private Long visitId;

    // ── Bill ─────────────────────────────────────────────────────────────────
    @NotNull(message = "Bill date is required")
    private LocalDate date;

    @NotEmpty(message = "At least one line item is required")
    @Valid
    private List<BillItemRequest> items;

    /**
     * Overall (bill-level) discount applied to the subtotal. When provided (> 0),
     * this REPLACES per-line discounts: the bill's totalDiscount is set to this
     * value and totalAmount = subtotal − discount. Null/0 falls back to the sum
     * of per-line discounts (legacy behaviour).
     */
    @DecimalMin("0.0")
    private BigDecimal discount;

    // ── Payment ───────────────────────────────────────────────────────────────
    private PaymentMode paymentMode;

    @Size(max = 60)
    private String referenceNo;

    /** Amount paid at time of bill creation (0 = save as Pending) */
    @DecimalMin("0.0")
    private BigDecimal amountPaid = BigDecimal.ZERO;

    /** If true, save as DRAFT without generating payment */
    private boolean draft = false;

    @Size(max = 150)
    private String createdBy;

    // ── Insurance ─────────────────────────────────────────────────────────────
    private boolean insurance = false;

    @Size(max = 150)
    private String insuranceCompany;

    private Long insuranceCompanyId;

    @Size(max = 60)
    private String policyNo;

    @Size(max = 150)
    private String insuredPersonName;

    @Size(max = 60)
    private String cardNumber;

    @DecimalMin("0.0")
    private BigDecimal claimedAmount;

    /** True when line items were priced at insurer tariff rates (set by frontend) */
    private boolean insuranceTariffApplied = false;

    // ── OP token advance + free-consultation refund ────────────────────────────
    /** Cash already collected at OP token time, carried onto the bill. */
    @DecimalMin("0.0")
    private BigDecimal initialCollected = BigDecimal.ZERO;

    /** Cash refunded at bill time (token advance in excess of the net bill). */
    @DecimalMin("0.0")
    private BigDecimal refundAmount = BigDecimal.ZERO;
}
