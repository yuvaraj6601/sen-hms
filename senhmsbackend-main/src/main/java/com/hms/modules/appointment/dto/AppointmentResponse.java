package com.hms.modules.appointment.dto;

import com.hms.modules.appointment.enums.AppointmentStatus;
import com.hms.modules.appointment.enums.AppointmentType;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class AppointmentResponse {

    private Long id;
    private String appointmentNo;

    // Patient
    private Long patientId;
    private String patientName;
    private String uhid;
    private String phone;
    private String patientCategory;

    // Doctor
    private Long doctorId;
    private String doctorName;
    private String department;

    // Details
    private LocalDate date;
    private String time;
    private AppointmentType type;
    private AppointmentStatus status;
    private String reason;
    private String bookedBy;
    private LocalDate bookedDate;

    // Completion / Cancel
    private String completionNotes;
    private String cancelReason;

    // Review / Follow-up
    private LocalDate originalVisitDate;
    private String reviewNotes;

    // Token
    private String tokenNo;
    private Long opVisitId;

    // SMS
    private boolean smsSent;

    // Audit
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
