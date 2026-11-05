package com.hms.modules.admission.enums;

/**
 * How an insured patient's claim is settled.
 *
 * REIMBURSEMENT – patient pays the hospital in full, then claims the amount
 *                 back from the insurer later using the hospital bill.
 * CASHLESS      – the hospital bills the insurer / TPA directly; the patient
 *                 does not pay upfront (direct / cashless claim).
 */
public enum InsuranceClaimType {
    REIMBURSEMENT,
    CASHLESS
}
