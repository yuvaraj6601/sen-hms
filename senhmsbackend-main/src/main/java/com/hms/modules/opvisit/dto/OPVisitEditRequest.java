package com.hms.modules.opvisit.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Edits the token-time payment of an existing OP visit (the generated OP slip).
 * Used by the receptionist to apply a discount / adjust the collected amount
 * after a doctor marks a consultation free. All fields are optional — only the
 * provided ones are updated.
 */
@Data
public class OPVisitEditRequest {

    /** Consultation charge for the visit. */
    private BigDecimal consultationAmount;

    /** Discount applied. When it covers the full consultation the visit is free. */
    private BigDecimal discountAmount;

    /** Amount actually collected = consultationAmount − discountAmount. */
    private BigDecimal paidAmount;

    /** JSON array of split payments, e.g. [{"mode":"CASH","amount":500},{"mode":"CARD","amount":500}]. */
    private String paymentSplitsJson;

    /** Primary payment mode: CASH / UPI / CARD. */
    @Size(max = 30)
    private String paymentType;
}
