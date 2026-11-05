package com.hms.masters.controller;

import com.hms.common.ApiResponse;
import com.hms.masters.dto.InsuranceTariffBulkRequest;
import com.hms.masters.dto.InsuranceTariffRequest;
import com.hms.masters.dto.InsuranceTariffResponse;
import com.hms.masters.dto.InsurerCodeRateRequest;
import com.hms.masters.service.InsuranceTariffService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Insurance Tariff Master
 * Base path: /api/masters/insurance-tariffs
 *
 * Manages insurer-specific price lists. For a given insurance company,
 * each service in BillingMaster can have a different agreed tariff price.
 * When a bill is raised for an insurance patient the billing screen uses
 * this tariff to replace the default hospital price per line item.
 */
@RestController
@RequestMapping("/masters/insurance-tariffs")
@RequiredArgsConstructor
public class InsuranceTariffController {

    private final InsuranceTariffService service;

    /**
     * All tariff rows for a given insurer, optionally filtered by search text.
     *
     * Primary endpoint for the billing screen:
     *   GET /api/masters/insurance-tariffs?insuranceCompanyId=5
     *   → returns full price map for that insurer
     *
     * Tariff management UI:
     *   GET /api/masters/insurance-tariffs?insuranceCompanyId=5&search=ward
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<InsuranceTariffResponse>>> getByCompany(
            @RequestParam Long insuranceCompanyId,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(ApiResponse.ok(service.getByCompany(insuranceCompanyId, search)));
    }

    /**
     * Single-service lookup.
     *   GET /api/masters/insurance-tariffs/lookup?insuranceCompanyId=5&serviceCode=ROOM-GEN
     */
    @GetMapping("/lookup")
    public ResponseEntity<ApiResponse<InsuranceTariffResponse>> lookup(
            @RequestParam Long insuranceCompanyId,
            @RequestParam String serviceCode) {
        return ResponseEntity.ok(ApiResponse.ok(
                service.getByCompanyAndService(insuranceCompanyId, serviceCode)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<InsuranceTariffResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(service.getById(id)));
    }

    /** Create a single tariff row */
    @PostMapping
    public ResponseEntity<ApiResponse<InsuranceTariffResponse>> create(
            @Valid @RequestBody InsuranceTariffRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.create(req)));
    }

    /** Update an existing tariff row */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<InsuranceTariffResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody InsuranceTariffRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Updated successfully", service.update(id, req)));
    }

    /**
     * Delete a tariff row.
     * After deletion, the billing screen falls back to the hospital rate for
     * that service when this insurer's patient is billed.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("Tariff entry deleted", null));
    }

    /**
     * Bulk upsert — create or update many tariff rows for one insurer at once.
     * Used when entering a full rate list from a contract document or Excel sheet.
     *
     * POST /api/masters/insurance-tariffs/bulk
     * Body: { insuranceCompanyId: 5, items: [{serviceCode, tariffPrice, excluded, notes}] }
     */
    @PostMapping("/bulk")
    public ResponseEntity<ApiResponse<List<InsuranceTariffResponse>>> bulkUpsert(
            @Valid @RequestBody InsuranceTariffBulkRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(
                "Bulk upsert completed", service.bulkUpsert(req)));
    }

    /**
     * Change the tariff price for all services sharing one insurer code.
     * POST /api/masters/insurance-tariffs/rate-by-code
     * Body: { insuranceCompanyId, insurerCode, tariffPrice }
     */
    @PostMapping("/rate-by-code")
    public ResponseEntity<ApiResponse<List<InsuranceTariffResponse>>> updateRateByInsurerCode(
            @Valid @RequestBody InsurerCodeRateRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(
                "Rate updated for insurer code", service.updateRateByInsurerCode(req)));
    }
}
