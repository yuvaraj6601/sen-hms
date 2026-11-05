package com.hms.modules.admission.dto;

import com.hms.modules.admission.enums.TransferType;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class TransferLogResponse {

    private Long id;
    private String transferNo;
    private Long admissionId;
    private String admissionNo;
    private Long patientId;
    private String uhid;
    private String patientName;
    private TransferType transferType;
    private String fromValue;
    private String toValue;
    private Long toId;
    private LocalDate transferDate;
    private String transferTime;
    private String reason;
    private String orderedBy;
    private String doneBy;
    private String notes;
    private String createdBy;
    private LocalDateTime createdAt;
}
