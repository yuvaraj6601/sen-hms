package com.hms.modules.discharge.controller;

import com.hms.common.ApiResponse;
import com.hms.modules.discharge.dto.DischargeSummaryRequest;
import com.hms.modules.discharge.dto.DischargeSummaryResponse;
import com.hms.modules.discharge.service.DischargeSummaryService;
import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/discharge-summary")
@RequiredArgsConstructor
public class DischargeSummaryController {

    private final DischargeSummaryService service;

    /**
     * GET /api/discharge-summary/by-admission/{admissionId}
     * Fetch the discharge summary for a given admission.
     * Returns 404 if not yet created.
     */
    @GetMapping("/by-admission/{admissionId}")
    public ResponseEntity<ApiResponse<DischargeSummaryResponse>> getByAdmission(
            @PathVariable Long admissionId) {
        try {
            return ResponseEntity.ok(ApiResponse.ok(service.getByAdmissionId(admissionId)));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(e.getMessage()));
        }
    }

    /**
     * GET /api/discharge-summary/{id}
     * Fetch by primary key.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DischargeSummaryResponse>> getById(
            @PathVariable Long id) {
        try {
            return ResponseEntity.ok(ApiResponse.ok(service.getById(id)));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(e.getMessage()));
        }
    }

    /**
     * POST /api/discharge-summary
     * Create a new discharge summary.
     */
    @PostMapping
    public ResponseEntity<ApiResponse<DischargeSummaryResponse>> create(
            @Valid @RequestBody DischargeSummaryRequest req) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(ApiResponse.created(service.create(req)));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(ApiResponse.error(e.getMessage()));
        }
    }

    /**
     * PUT /api/discharge-summary/by-admission/{admissionId}
     * Upsert — creates if not exists, updates if it does.
     * This is the primary save endpoint used by the frontend.
     */
    @PutMapping("/by-admission/{admissionId}")
    public ResponseEntity<ApiResponse<DischargeSummaryResponse>> upsert(
            @PathVariable Long admissionId,
            @Valid @RequestBody DischargeSummaryRequest req) {
        req.setAdmissionId(admissionId);
        return ResponseEntity.ok(ApiResponse.ok("Discharge summary saved", service.upsert(req)));
    }

    /**
     * PUT /api/discharge-summary/{id}
     * Update by primary key.
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<DischargeSummaryResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody DischargeSummaryRequest req) {
        try {
            return ResponseEntity.ok(ApiResponse.ok("Updated", service.update(id, req)));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(e.getMessage()));
        }
    }

    /**
     * DELETE /api/discharge-summary/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        try {
            service.delete(id);
            return ResponseEntity.ok(ApiResponse.ok("Deleted", null));
        } catch (EntityNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(ApiResponse.error(e.getMessage()));
        }
    }
}
