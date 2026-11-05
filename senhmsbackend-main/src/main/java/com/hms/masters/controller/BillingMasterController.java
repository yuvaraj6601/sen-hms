package com.hms.masters.controller;

import com.hms.common.ApiResponse;
import com.hms.common.PagedResponse;
import com.hms.masters.dto.BillingMasterRequest;
import com.hms.masters.dto.BillingMasterResponse;
import com.hms.masters.enums.Status;
import com.hms.masters.service.BillingMasterService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/masters/billing-masters")
@RequiredArgsConstructor
public class BillingMasterController {

    private final BillingMasterService service;

    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<BillingMasterResponse>>> search(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long modalityId,
            @RequestParam(required = false) Status status,
            @RequestParam(required = false) Boolean showInOp,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        var pageable = PageRequest.of(page, size, Sort.by("serviceName"));
        return ResponseEntity.ok(ApiResponse.ok(
                new PagedResponse<>(service.search(search, modalityId, status, showInOp, pageable))));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<BillingMasterResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(service.getById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<BillingMasterResponse>> create(
            @Valid @RequestBody BillingMasterRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.create(req)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<BillingMasterResponse>> update(
            @PathVariable Long id, @Valid @RequestBody BillingMasterRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Updated successfully", service.update(id, req)));
    }

    @PatchMapping("/{id}/toggle-status")
    public ResponseEntity<ApiResponse<BillingMasterResponse>> toggleStatus(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Status updated", service.toggleStatus(id)));
    }
}
