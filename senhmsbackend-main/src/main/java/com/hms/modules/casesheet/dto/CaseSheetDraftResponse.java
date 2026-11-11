package com.hms.modules.casesheet.dto;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/** AI-read case sheet, returned for doctor review before anything is saved. */
@Data
public class CaseSheetDraftResponse {
    private List<ObservationRequest> observations = new ArrayList<>();
    private List<VitalSignRequest> vitals = new ArrayList<>();
    /** Nested discharge summary in the hospital template (see CaseSheetOpenAiClient.DISCHARGE_TEMPLATE) */
    private JsonNode dischargeSummary;
}
