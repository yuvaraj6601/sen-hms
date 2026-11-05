package com.hms.modules.insurance.enums;

/**
 * Insurance workflow status — the SINGLE source of truth for an insurance
 * admission's progress. The admission's {@code insuranceStatus} mirrors this
 * 1:1 (same values), and the bill's insurance display reads from the claim.
 *
 * These five stages replaced the old six-value model
 * (SUBMITTED / UNDER_REVIEW / APPROVED / PARTIAL / SETTLED / REJECTED).
 * A one-time SQL migration converts existing rows to these values.
 */
public enum ClaimStatus {
    /** Marked as insurance; company / policy / TPA not yet entered (pre-cumulative). */
    DETAILS_INCOMPLETE,
    /** Cumulative bill generated and sent to the insurer / TPA for approval. */
    SENT_FOR_APPROVAL,
    /** Insurer approved the claim (authorized / co-pay / approved amounts entered). */
    APPROVED,
    /** Claim filed against the insurer. */
    CLAIMED,
    /** Claim settled / paid. */
    SETTLED,
    /**
     * Insurer declined the claim — terminal off-ramp. The approved amount is
     * cleared to zero on decline so the patient owes the full outstanding
     * balance (the insurer pays nothing).
     */
    DECLINED
}
