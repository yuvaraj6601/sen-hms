package com.hms.modules.insurance.controller;

import com.hms.common.ApiResponse;
import com.hms.common.PagedResponse;
import com.hms.modules.insurance.dto.*;
import com.hms.modules.insurance.enums.ClaimStatus;
import com.hms.modules.insurance.service.InsuranceClaimService;
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
@RequestMapping("/insurance/claims")
@RequiredArgsConstructor
public class InsuranceClaimController {

    private final InsuranceClaimService service;

    /** GET /api/insurance/claims?status=SUBMITTED&company=Star&page=0&size=20 */
    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<InsuranceClaimResponse>>> search(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) ClaimStatus status,
            @RequestParam(required = false) String company,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {

        var pageable = PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "submittedDate"));
        return ResponseEntity.ok(ApiResponse.ok(
                new PagedResponse<>(service.search(search, status, company,
                        dateFrom, dateTo, pageable))));
    }

    /** GET /api/insurance/claims/{id} */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<InsuranceClaimResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(service.getById(id)));
    }

    /** GET /api/insurance/claims/patient/{patientId} */
    @GetMapping("/patient/{patientId}")
    public ResponseEntity<ApiResponse<List<InsuranceClaimResponse>>> getByPatient(
            @PathVariable Long patientId) {
        return ResponseEntity.ok(ApiResponse.ok(service.getByPatient(patientId)));
    }

    /** POST /api/insurance/claims */
    @PostMapping
    public ResponseEntity<ApiResponse<InsuranceClaimResponse>> create(
            @Valid @RequestBody InsuranceClaimRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.create(req)));
    }

    /**
     * Advance claim status: DETAILS_INCOMPLETE → SENT_FOR_APPROVAL → APPROVED → CLAIMED → SETTLED
     * (DECLINED is a terminal off-ramp from any pre-settlement stage).
     * PATCH /api/insurance/claims/{id}/status
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<InsuranceClaimResponse>> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody ClaimStatusRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Status updated",
                service.updateStatus(id, req)));
    }
}
