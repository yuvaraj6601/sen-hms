package com.hms.modules.appointment.dto;

import com.hms.modules.appointment.enums.AppointmentType;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDate;

@Data
public class AppointmentRequest {

    // ── Patient ───────────────────────────────────────────────────────────────
    @NotNull(message = "Patient ID is required")
    private Long patientId;

    @NotBlank @Size(max = 150)
    private String patientName;

    @NotBlank @Size(max = 25)
    private String uhid;

    @Size(max = 20)
    private String phone;

    @Size(max = 5)
    private String patientCategory;   // OP / IP

    // ── Doctor ────────────────────────────────────────────────────────────────
    /**
     * When a Doctor user books/views appointments, the frontend
     * passes their doctorId from the session — ensuring doctor-scoped filtering.
     */
    @NotNull(message = "Doctor ID is required")
    private Long doctorId;

    @NotBlank @Size(max = 150)
    private String doctorName;

    @Size(max = 100)
    private String department;

    // ── Appointment ───────────────────────────────────────────────────────────
    @NotNull(message = "Date is required")
    private LocalDate date;

    @NotBlank @Size(max = 10)
    private String time;

    private AppointmentType type = AppointmentType.NEW;

    /** Optional — reason/notes for the visit (no longer collected on the booking form). */
    private String reason;

    @Size(max = 150)
    private String bookedBy;

    // ── Review fields (for Review/Follow-up types) ────────────────────────────
    private LocalDate originalVisitDate;
    private String reviewNotes;
}
