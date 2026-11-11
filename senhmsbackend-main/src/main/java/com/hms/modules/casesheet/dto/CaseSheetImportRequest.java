package com.hms.modules.casesheet.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/** Reviewed draft to save against one admission. Patient / admission links are taken from the admission. */
@Data
public class CaseSheetImportRequest {
    private List<ObservationRequest> observations = new ArrayList<>();
    private List<VitalSignRequest> vitals = new ArrayList<>();
    /** Nested discharge summary; null skips the discharge summary */
    private JsonNode dischargeSummary;
}
