package com.hms.modules.prescription.dto;

import com.hms.modules.prescription.enums.PrescriptionSource;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class PrescriptionRequest {

    @NotNull(message = "Patient ID is required")
    private Long patientId;

    @NotBlank(message = "UHID is required")
    private String uhid;

    private Long admissionId;
    private Long visitId;

    @NotBlank(message = "Doctor name is required")
    @Size(max = 150)
    private String doctorName;

    private Long doctorId;

    private String diagnosis;
    private String notes;

    private PrescriptionSource source = PrescriptionSource.MANUAL;

    /** Only kept for AI drafts (VOICE / HANDWRITTEN): the transcript or the text read from the image. */
    private String voiceTranscript;

    @NotEmpty(message = "At least one medicine is required")
    @Valid
    private List<PrescriptionItemDto> items;
}
