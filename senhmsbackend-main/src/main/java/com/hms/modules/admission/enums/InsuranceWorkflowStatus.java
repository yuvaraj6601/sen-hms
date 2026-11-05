package com.hms.modules.admission.enums;

/**
 * Workflow stage of an insurance admission, tracked on the Admission record.
 *
 * This is distinct from the insurance CLAIM status (see
 * {@code com.hms.modules.insurance.enums.ClaimStatus}). It represents the
 * front-desk / coordinator view of where an insurance patient is in the
 * approval → claim → settlement pipeline, starting the moment the patient is
 * simply marked as "insurance" at admission time (before any details exist).
 */
public enum InsuranceWorkflowStatus {
    /** Marked as insurance at admit time; company / policy / TPA not yet entered. */
    DETAILS_INCOMPLETE,
    /** Pre-auth / documents sent to the insurer / TPA for approval. */
    SENT_FOR_APPROVAL,
    /** Insurer approved the claim. */
    APPROVED,
    /** Claim filed against the insurer. */
    CLAIMED,
    /** Claim settled / paid. */
    SETTLED,
    /** Insurer declined the claim — terminal off-ramp (patient owes full balance). */
    DECLINED
}
