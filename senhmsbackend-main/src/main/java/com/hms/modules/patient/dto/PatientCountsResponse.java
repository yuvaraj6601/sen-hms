package com.hms.modules.patient.dto;

import lombok.Data;

/**
 * Per-type patient totals for the patient-list filter dropdown.
 *
 * {@code all} = op + ip + both. Returned by {@code GET /patients/counts} so the
 * dropdown counts stay accurate once the list moved to server-side paging — the
 * loaded page alone can no longer compute them.
 */
@Data
public class PatientCountsResponse {
    private long all;
    private long op;
    private long ip;
    private long both;
}
