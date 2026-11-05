package com.hms.modules.patient.controller;

import com.hms.common.ApiResponse;
import com.hms.common.PagedResponse;
import com.hms.modules.patient.dto.PatientRequest;
import com.hms.modules.patient.dto.PatientResponse;
import com.hms.modules.patient.dto.PatientSummaryResponse;
import com.hms.modules.patient.dto.PatientCountsResponse;
import com.hms.modules.patient.dto.RegisterAdmitRequest;
import com.hms.modules.patient.dto.RegisterAdmitResponse;
import com.hms.modules.patient.enums.PatientType;
import com.hms.modules.patient.service.PatientService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/patients")
@RequiredArgsConstructor
public class PatientController {

    private final PatientService service;

    /**
     * Paginated search — supports name, UHID, phone, email search across the
     * whole DB (not just the current page). Optional filters: one or more
     * patientType values (repeat the param for "In Patients" = IP + BOTH),
     * active (true/false), and a createdAt date range (dateFrom/dateTo, both
     * inclusive, YYYY-MM-DD). Sorted newest-first.
     *
     * GET /api/patients?search=John&patientType=OP&active=true&dateFrom=2026-01-01&dateTo=2026-01-31&page=0&size=50
     */
    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<PatientSummaryResponse>>> search(
            @RequestParam(required = false) String search,
            @RequestParam(value = "patientType", required = false) List<PatientType> patientTypes,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) LocalDate dateFrom,
            @RequestParam(required = false) LocalDate dateTo,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {

        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return ResponseEntity.ok(ApiResponse.ok(
                new PagedResponse<>(service.search(search, patientTypes, active, dateFrom, dateTo, pageable))));
    }

    /**
     * Per-type patient totals for the filter dropdown.
     * GET /api/patients/counts → { all, op, ip, both }
     */
    @GetMapping("/counts")
    public ResponseEntity<ApiResponse<PatientCountsResponse>> counts() {
        return ResponseEntity.ok(ApiResponse.ok(service.counts()));
    }

    /**
     * Full patient record by DB id.
     * GET /api/patients/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<PatientResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(service.getById(id)));
    }

    /**
     * Full patient record by UHID.
     * GET /api/patients/uhid/UHID-20260101-00001
     */
    @GetMapping("/uhid/{uhid}")
    public ResponseEntity<ApiResponse<PatientResponse>> getByUhid(@PathVariable String uhid) {
        return ResponseEntity.ok(ApiResponse.ok(service.getByUhid(uhid)));
    }

    /**
     * Register a new patient — UHID auto-assigned.
     * POST /api/patients
     */
    @PostMapping
    public ResponseEntity<ApiResponse<PatientResponse>> create(
            @Valid @RequestBody PatientRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.create(req)));
    }

    /**
     * Register a brand-new IN-patient AND admit them in ONE atomic transaction.
     * Either both the patient and the admission are created, or neither is.
     * POST /api/patients/register-admit
     */
    @PostMapping("/register-admit")
    public ResponseEntity<ApiResponse<RegisterAdmitResponse>> registerAndAdmit(
            @Valid @RequestBody RegisterAdmitRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(
                        service.registerAndAdmit(req.getPatient(), req.getAdmission())));
    }

    /**
     * Update patient demographics / contact / insurance details.
     * PUT /api/patients/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<PatientResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody PatientRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Updated successfully", service.update(id, req)));
    }

    /**
     * Toggle active / inactive (soft-delete equivalent).
     * PATCH /api/patients/{id}/toggle-status
     */
    @PatchMapping("/{id}/toggle-status")
    public ResponseEntity<ApiResponse<PatientResponse>> toggleStatus(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Status updated", service.toggleStatus(id)));
    }
}
