package com.hms.modules.prescription.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/** AI-generated draft. Never persisted — the doctor reviews it and confirms via POST /prescriptions. */
@Data
public class VoiceDraftResponse {
    private String transcript;
    private String diagnosis;
    private String notes;
    private List<PrescriptionItemDto> items = new ArrayList<>();
}
