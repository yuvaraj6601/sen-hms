package com.hms.masters.controller;

import com.hms.common.ApiResponse;
import com.hms.masters.dto.BillingModalityRequest;
import com.hms.masters.dto.BillingModalityResponse;
import com.hms.masters.service.BillingModalityService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/masters/billing-modalities")
@RequiredArgsConstructor
public class BillingModalityController {

    private final BillingModalityService service;

    @GetMapping
    public ResponseEntity<ApiResponse<List<BillingModalityResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.ok(service.getAll()));
    }

    @GetMapping("/active")
    public ResponseEntity<ApiResponse<List<BillingModalityResponse>>> getActive() {
        return ResponseEntity.ok(ApiResponse.ok(service.getActive()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<BillingModalityResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(service.getById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<BillingModalityResponse>> create(
            @Valid @RequestBody BillingModalityRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.create(req)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<BillingModalityResponse>> update(
            @PathVariable Long id, @Valid @RequestBody BillingModalityRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Updated successfully", service.update(id, req)));
    }

    @PatchMapping("/{id}/toggle-status")
    public ResponseEntity<ApiResponse<BillingModalityResponse>> toggleStatus(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Status updated", service.toggleStatus(id)));
    }
}
