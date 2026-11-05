package com.hms.modules.opvisit.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class QueueStatsResponse {
    private long total;
    private long waiting;
    private long inConsultation;
    private long consultationDone;
    private long billed;
    private long paid;
}
