package com.hms.modules.appointment.dto;

import com.hms.modules.appointment.enums.AppointmentStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AppointmentStatusRequest {

    @NotNull(message = "Status is required")
    private AppointmentStatus status;

    /** Required when marking COMPLETED */
    private String completionNotes;

    /** Required when marking CANCELLED */
    private String cancelReason;
}
