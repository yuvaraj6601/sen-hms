package com.hms.modules.admission.controller;

import com.hms.common.ApiResponse;
import com.hms.common.PagedResponse;
import com.hms.modules.admission.dto.*;
import com.hms.modules.admission.enums.AdmissionStatus;
import com.hms.modules.admission.service.AdmissionService;
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
@RequestMapping("/admissions")
@RequiredArgsConstructor
public class AdmissionController {

    private final AdmissionService service;

    /**
     * Paginated search — supports name, UHID, admission no, phone.
     * Optional filters: status, admittingDoctorId, wardId, dateFrom, dateTo.
     *
     * GET /api/admissions?search=John&status=ADMITTED&wardId=1&page=0&size=20
     */
    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<AdmissionResponse>>> search(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) AdmissionStatus status,
            @RequestParam(required = false) Long admittingDoctorId,
            @RequestParam(required = false) Long wardId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {

        var pageable = PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "admissionDate"));
        return ResponseEntity.ok(ApiResponse.ok(
                new PagedResponse<>(service.search(search, status, admittingDoctorId,
                        wardId, dateFrom, dateTo, pageable))));
    }

    /**
     * Full admission record by DB id (includes transfer history).
     * GET /api/admissions/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<AdmissionResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(service.getById(id)));
    }

    /**
     * Full admission record by admission number.
     * GET /api/admissions/no/ADM-20260615-0001
     */
    @GetMapping("/no/{admissionNo}")
    public ResponseEntity<ApiResponse<AdmissionResponse>> getByAdmissionNo(
            @PathVariable String admissionNo) {
        return ResponseEntity.ok(ApiResponse.ok(service.getByAdmissionNo(admissionNo)));
    }

    /**
     * All admissions for a patient (history).
     * GET /api/admissions/patient/{patientId}
     */
    @GetMapping("/patient/{patientId}")
    public ResponseEntity<ApiResponse<List<AdmissionResponse>>> getByPatient(
            @PathVariable Long patientId) {
        return ResponseEntity.ok(ApiResponse.ok(service.getByPatientId(patientId)));
    }

    /**
     * Admit a patient — assigns bed, generates admission number.
     * POST /api/admissions
     */
    @PostMapping
    public ResponseEntity<ApiResponse<AdmissionResponse>> admit(
            @Valid @RequestBody AdmissionRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.admit(req)));
    }

    /**
     * Edit admission details (surgical, free, mlc, diagnosis, insurance, notes, etc.).
     * Does not change bed/ward (transfer), status, or discharge fields.
     * PUT /api/admissions/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<AdmissionResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody AdmissionEditRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Admission updated", service.updateAdmission(id, req)));
    }

    /**
     * Update condition status (STABLE / CRITICAL / SERIOUS / UNDER_OBSERVATION).
     * PATCH /api/admissions/{id}/status
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<AdmissionResponse>> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody AdmissionStatusRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Status updated", service.updateStatus(id, req)));
    }

    /**
     * Log a transfer (ward / bed / doctor / department / condition).
     * POST /api/admissions/{id}/transfers
     */
    @PostMapping("/{id}/transfers")
    public ResponseEntity<ApiResponse<TransferLogResponse>> transfer(
            @PathVariable Long id,
            @Valid @RequestBody TransferRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.transfer(id, req)));
    }

    /**
     * Initiate discharge — marks status as DISCHARGE_INITIATED.
     * PATCH /api/admissions/{id}/initiate-discharge
     */
    @PatchMapping("/{id}/initiate-discharge")
    public ResponseEntity<ApiResponse<AdmissionResponse>> initiateDischarge(
            @PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Discharge initiated",
                service.initiateDischarge(id)));
    }

    /**
     * Complete discharge — frees bed, sets discharge summary, status → DISCHARGED.
     * POST /api/admissions/{id}/discharge
     */
    @PostMapping("/{id}/discharge")
    public ResponseEntity<ApiResponse<AdmissionResponse>> discharge(
            @PathVariable Long id,
            @Valid @RequestBody DischargeRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Patient discharged successfully",
                service.discharge(id, req)));
    }
}
