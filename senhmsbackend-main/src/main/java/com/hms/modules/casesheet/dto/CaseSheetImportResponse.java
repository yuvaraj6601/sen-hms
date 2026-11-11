package com.hms.modules.casesheet.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class CaseSheetImportResponse {
    private int observationsSaved;
    private int vitalsSaved;
    private boolean dischargeSummarySaved;
}
