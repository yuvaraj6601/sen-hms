package com.hms.modules.billing.dto;

import com.hms.modules.billing.enums.PaymentMode;
import com.hms.modules.billing.enums.ReceiptType;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * "Collect Cash" request from the patient list. Records a receipt
 * (advance / settlement / refund) against the admission's single bill,
 * creating a DRAFT bill for the admission if none exists yet.
 */
@Data
public class CollectRequest {

    @NotNull(message = "Patient ID is required")
    private Long patientId;

    /** Active admission; resolved from the patient when null. */
    private Long admissionId;

    // Denormalised patient context (used only when a new draft bill is created).
    private String patientName;
    private String uhid;
    private Integer age;
    private String gender;
    private String phone;
    private String doctorName;
    private String department;
    private String ward;
    private String bedNumber;

    @NotNull(message = "Amount is required")
    private BigDecimal amount;

    @NotNull(message = "Payment mode is required")
    private PaymentMode paymentMode;

    /** JSON array of splits — used only when paymentMode = MIXED. */
    private String paymentSplitsJson;

    @NotNull(message = "Receipt type is required")
    private ReceiptType receiptType;

    private LocalDate date;
    private String referenceNo;
    private String receivedBy;
    private String transactionGroupId;
}
