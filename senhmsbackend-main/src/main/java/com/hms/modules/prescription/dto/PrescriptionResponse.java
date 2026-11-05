package com.hms.modules.prescription.dto;

import com.hms.modules.prescription.enums.PrescriptionSource;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class PrescriptionResponse {
    private Long id;
    private String prescriptionNo;
    private String patientId;
    private String uhid;
    private String patientName;
    private Long admissionId;
    private Long visitId;
    private String doctorName;
    private LocalDate visitDate;
    private String diagnosis;
    private String notes;
    private PrescriptionSource source;
    private String voiceTranscript;
    private LocalDateTime createdAt;
    private List<PrescriptionItemDto> items = new ArrayList<>();
}
