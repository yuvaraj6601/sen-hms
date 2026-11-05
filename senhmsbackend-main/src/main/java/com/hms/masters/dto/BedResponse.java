package com.hms.masters.dto;

import com.hms.masters.entity.Bed.BedStatus;
import lombok.Data;

@Data
public class BedResponse {
    private Long id;
    private String number;
    private Long wardId;
    private String wardName;
    private BedStatus status;
    private Long patientId;
    private String patientName;
}
