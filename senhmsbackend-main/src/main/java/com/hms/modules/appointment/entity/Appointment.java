package com.hms.modules.appointment.entity;

import com.hms.common.BaseEntity;
import com.hms.modules.appointment.enums.AppointmentStatus;
import com.hms.modules.appointment.enums.AppointmentType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "appointments")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Appointment extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Auto-generated: APT-YYYYMMDD-XXXX */
    @Column(name = "appointment_no", unique = true, nullable = false, length = 25)
    private String appointmentNo;

    // ── Patient ───────────────────────────────────────────────────────────────

    @Column(name = "patient_id", nullable = false)
    private Long patientId;

    @Column(name = "patient_name", nullable = false, length = 150)
    private String patientName;

    @Column(nullable = false, length = 25)
    private String uhid;

    @Column(length = 20)
    private String phone;

    /** OP or IP */
    @Column(name = "patient_category", length = 5)
    private String patientCategory;

    // ── Doctor ────────────────────────────────────────────────────────────────
    /**
     * doctorId references the Doctor entity (masters).
     * When a Doctor user logs in, their doctorId from the User record
     * is used to filter appointments to only their own.
     */
    @Column(name = "doctor_id", nullable = false)
    private Long doctorId;

    @Column(name = "doctor_name", nullable = false, length = 150)
    private String doctorName;

    @Column(length = 100)
    private String department;

    // ── Appointment details ───────────────────────────────────────────────────

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false, length = 10)
    private String time;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private AppointmentType type = AppointmentType.NEW;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private AppointmentStatus status = AppointmentStatus.SCHEDULED;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(name = "booked_by", length = 150)
    private String bookedBy;

    @Column(name = "booked_date")
    private LocalDate bookedDate;

    // ── Completion ────────────────────────────────────────────────────────────

    @Column(name = "completion_notes", columnDefinition = "TEXT")
    private String completionNotes;

    @Column(name = "cancel_reason", columnDefinition = "TEXT")
    private String cancelReason;

    // ── Review / Follow-up link ───────────────────────────────────────────────

    @Column(name = "original_visit_date")
    private LocalDate originalVisitDate;

    @Column(name = "review_notes", columnDefinition = "TEXT")
    private String reviewNotes;

    // ── Token (issued when OP appointment is confirmed) ───────────────────────

    @Column(name = "token_no", length = 20)
    private String tokenNo;

    @Column(name = "op_visit_id")
    private Long opVisitId;

    // ── SMS ───────────────────────────────────────────────────────────────────

    @Column(name = "sms_sent", nullable = false)
    private boolean smsSent = false;
}
