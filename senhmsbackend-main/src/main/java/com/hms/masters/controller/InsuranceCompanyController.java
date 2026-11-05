package com.hms.masters.controller;

import com.hms.common.ApiResponse;
import com.hms.masters.dto.InsuranceCompanyRequest;
import com.hms.masters.dto.InsuranceCompanyResponse;
import com.hms.masters.service.InsuranceCompanyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/masters/insurance-companies")
@RequiredArgsConstructor
public class InsuranceCompanyController {

    private final InsuranceCompanyService service;

    /**
     * GET /api/masters/insurance-companies
     * Accepts optional ?search=, ?active=true, ?page=, ?size= for compatibility.
     * Returns all companies (filtered by active flag if provided).
     */
    @GetMapping
    public ResponseEntity<ApiResponse<List<InsuranceCompanyResponse>>> getAll(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean active,
            @RequestParam(defaultValue = "0")   int page,
            @RequestParam(defaultValue = "200") int size) {
        List<InsuranceCompanyResponse> list = (active != null && active)
                ? service.getActive()
                : service.getAll();
        // apply optional name/search filter in memory (small dataset)
        if (search != null && !search.isBlank()) {
            String q = search.toLowerCase();
            list = list.stream()
                    .filter(c -> c.getName().toLowerCase().contains(q)
                            || (c.getTpaName() != null && c.getTpaName().toLowerCase().contains(q))
                            || c.getCompanyCode().toLowerCase().contains(q))
                    .toList();
        }
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    @GetMapping("/active")
    public ResponseEntity<ApiResponse<List<InsuranceCompanyResponse>>> getActive() {
        return ResponseEntity.ok(ApiResponse.ok(service.getActive()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<InsuranceCompanyResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(service.getById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<InsuranceCompanyResponse>> create(
            @Valid @RequestBody InsuranceCompanyRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.create(req)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<InsuranceCompanyResponse>> update(
            @PathVariable Long id, @Valid @RequestBody InsuranceCompanyRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Updated successfully", service.update(id, req)));
    }

    @PatchMapping("/{id}/toggle-status")
    public ResponseEntity<ApiResponse<InsuranceCompanyResponse>> toggleStatus(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Status updated", service.toggleStatus(id)));
    }
}
