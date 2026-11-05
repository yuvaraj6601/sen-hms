package com.hms.modules.casesheet.controller;

import com.hms.common.ApiResponse;
import com.hms.modules.casesheet.dto.*;
import com.hms.modules.casesheet.service.CaseSheetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/case-sheet")
@RequiredArgsConstructor
public class CaseSheetController {

    private final CaseSheetService service;

    // ════════════════════════════════════════════════════════
    // OBSERVATIONS
    // ════════════════════════════════════════════════════════

    /**
     * All observations for a patient (all admissions/visits combined).
     * GET /api/case-sheet/observations?patientId=1
     */
    @GetMapping("/observations")
    public ResponseEntity<ApiResponse<List<ObservationResponse>>> getObservations(
            @RequestParam(required = false) Long patientId,
            @RequestParam(required = false) Long admissionId,
            @RequestParam(required = false) Long visitId) {

        List<ObservationResponse> result;
        if (admissionId != null) {
            result = service.getObservationsByAdmission(admissionId);
        } else if (visitId != null) {
            result = service.getObservationsByVisit(visitId);
        } else if (patientId != null) {
            result = service.getObservationsByPatient(patientId);
        } else {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Provide patientId, admissionId, or visitId"));
        }
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    /**
     * Add a doctor observation / round note.
     * POST /api/case-sheet/observations
     */
    @PostMapping("/observations")
    public ResponseEntity<ApiResponse<ObservationResponse>> addObservation(
            @Valid @RequestBody ObservationRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.addObservation(req)));
    }

    // ════════════════════════════════════════════════════════
    // MEDICATIONS
    // ════════════════════════════════════════════════════════

    /**
     * All medications for a patient / admission / visit.
     * GET /api/case-sheet/medications?patientId=1
     * GET /api/case-sheet/medications?admissionId=5
     */
    @GetMapping("/medications")
    public ResponseEntity<ApiResponse<List<MedicationResponse>>> getMedications(
            @RequestParam(required = false) Long patientId,
            @RequestParam(required = false) Long admissionId,
            @RequestParam(required = false) Long visitId) {

        List<MedicationResponse> result;
        if (admissionId != null) {
            result = service.getMedicationsByAdmission(admissionId);
        } else if (visitId != null) {
            result = service.getMedicationsByVisit(visitId);
        } else if (patientId != null) {
            result = service.getMedicationsByPatient(patientId);
        } else {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Provide patientId, admissionId, or visitId"));
        }
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    /**
     * Prescribe a medication.
     * POST /api/case-sheet/medications
     */
    @PostMapping("/medications")
    public ResponseEntity<ApiResponse<MedicationResponse>> prescribe(
            @Valid @RequestBody MedicationRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.prescribe(req)));
    }

    /**
     * Stop a medication with a reason.
     * PATCH /api/case-sheet/medications/{id}/stop
     */
    @PatchMapping("/medications/{id}/stop")
    public ResponseEntity<ApiResponse<MedicationResponse>> stopMedication(
            @PathVariable Long id,
            @Valid @RequestBody StopMedicationRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Medication stopped",
                service.stopMedication(id, req)));
    }

    // ════════════════════════════════════════════════════════
    // VITAL SIGNS
    // ════════════════════════════════════════════════════════

    /**
     * All vitals for a patient / admission / visit.
     * GET /api/case-sheet/vitals?patientId=1
     * GET /api/case-sheet/vitals?admissionId=5
     */
    @GetMapping("/vitals")
    public ResponseEntity<ApiResponse<List<VitalSignResponse>>> getVitals(
            @RequestParam(required = false) Long patientId,
            @RequestParam(required = false) Long admissionId,
            @RequestParam(required = false) Long visitId) {

        List<VitalSignResponse> result;
        if (admissionId != null) {
            result = service.getVitalsByAdmission(admissionId);
        } else if (visitId != null) {
            result = service.getVitalsByVisit(visitId);
        } else if (patientId != null) {
            result = service.getVitalsByPatient(patientId);
        } else {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Provide patientId, admissionId, or visitId"));
        }
        return ResponseEntity.ok(ApiResponse.ok(result));
    }

    /**
     * Record a vitals entry.
     * POST /api/case-sheet/vitals
     */
    @PostMapping("/vitals")
    public ResponseEntity<ApiResponse<VitalSignResponse>> recordVitals(
            @Valid @RequestBody VitalSignRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.recordVitals(req)));
    }
}
