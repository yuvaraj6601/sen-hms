package com.hms.modules.casesheet.client;

import com.hms.modules.casesheet.dto.CaseSheetDraftResponse;

import java.time.LocalDate;

public interface CaseSheetAiClient {

    /** Scanned case sheet (PDF or image) → draft observations, vitals and discharge summary. Nothing is saved. */
    /** admissionDate (may be null) anchors handwritten dates whose month the model misreads. */
    CaseSheetDraftResponse extractCaseSheet(byte[] file, String filename, String contentType, LocalDate admissionDate);
}
