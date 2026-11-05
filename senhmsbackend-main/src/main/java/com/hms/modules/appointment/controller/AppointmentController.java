package com.hms.modules.appointment.controller;

import com.hms.common.ApiResponse;
import com.hms.common.PagedResponse;
import com.hms.modules.appointment.dto.*;
import com.hms.modules.appointment.enums.AppointmentStatus;
import com.hms.modules.appointment.service.AppointmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/appointments")
@RequiredArgsConstructor
public class AppointmentController {

    private final AppointmentService service;

    /**
     * Paginated search with filters.
     *
     * Doctor login:   GET /api/appointments?doctorId={loggedInDoctorId}&date=2026-06-15
     * Admin/Recept:   GET /api/appointments?date=2026-06-15
     * All of a doctor: GET /api/appointments?doctorId=5
     *
     * The frontend is responsible for passing doctorId from the session
     * when the logged-in user is a Doctor — this enforces doctor-scoped filtering.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<AppointmentResponse>>> search(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) AppointmentStatus status,
            @RequestParam(required = false) Long doctorId,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String patientCategory,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {

        var pageable = PageRequest.of(page, size,
                Sort.by("date").descending().and(Sort.by("time")));
        return ResponseEntity.ok(ApiResponse.ok(
                new PagedResponse<>(service.search(search, status, doctorId,
                        department, patientCategory, date, dateFrom, dateTo, pageable))));
    }

    /**
     * Single appointment.
     * GET /api/appointments/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AppointmentResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(service.getById(id)));
    }

    /**
     * All appointments for a patient.
     * GET /api/appointments/patient/{patientId}
     */
    @GetMapping("/patient/{patientId}")
    public ResponseEntity<ApiResponse<List<AppointmentResponse>>> getByPatient(
            @PathVariable Long patientId) {
        return ResponseEntity.ok(ApiResponse.ok(service.getByPatient(patientId)));
    }

    /**
     * Today's appointments for a specific doctor — for the doctor dashboard.
     * Frontend calls this with the logged-in doctor's ID.
     * GET /api/appointments/doctor/{doctorId}/today
     */
    @GetMapping("/doctor/{doctorId}/today")
    public ResponseEntity<ApiResponse<List<AppointmentResponse>>> getTodayByDoctor(
            @PathVariable Long doctorId) {
        return ResponseEntity.ok(ApiResponse.ok(service.getTodayByDoctor(doctorId)));
    }

    /**
     * Book a new appointment.
     * POST /api/appointments
     */
    @PostMapping
    public ResponseEntity<ApiResponse<AppointmentResponse>> book(
            @Valid @RequestBody AppointmentRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.book(req)));
    }

    /**
     * Advance appointment status.
     * SCHEDULED → CONFIRMED → IN_PROGRESS → COMPLETED
     *                       → NO_SHOW
     *                       → CANCELLED
     * PATCH /api/appointments/{id}/status
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<AppointmentResponse>> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody AppointmentStatusRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Status updated",
                service.updateStatus(id, req)));
    }

    /**
     * Issue an OP token for a booked OP appointment — moves the patient into the
     * OP queue, generating a token that carries the booked appointment time as
     * the arrival time. Links the created OP visit back to the appointment.
     * POST /api/appointments/{id}/issue-token
     */
    @PostMapping("/{id}/issue-token")
    public ResponseEntity<ApiResponse<AppointmentResponse>> issueToken(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("OP token issued",
                service.issueOpToken(id)));
    }
}
