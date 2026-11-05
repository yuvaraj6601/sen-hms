package com.hms.masters.controller;

import com.hms.common.ApiResponse;
import com.hms.common.PagedResponse;
import com.hms.masters.dto.DropdownOptionRequest;
import com.hms.masters.dto.DropdownOptionResponse;
import com.hms.masters.enums.DropdownCategory;
import com.hms.masters.enums.Status;
import com.hms.masters.service.DropdownOptionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Managed dropdown options (Areas, Districts, Units) — all backed by the single
 * {@code dropdown_options} table and distinguished by {@code category}.
 *
 * Base path: /api/masters/dropdowns
 *
 * Forms consume these as:
 *   GET /api/masters/dropdowns?category=AREA&status=ACTIVE
 */
@RestController
@RequestMapping("/masters/dropdowns")
@RequiredArgsConstructor
public class DropdownOptionController {

    private final DropdownOptionService service;

    /** Paginated list for a given category — used by the master page and forms. */
    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<DropdownOptionResponse>>> search(
            @RequestParam DropdownCategory category,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Status status,
            @RequestParam(defaultValue = "0")   int page,
            @RequestParam(defaultValue = "500") int size) {

        var pageable = PageRequest.of(page, size,
                Sort.by(Sort.Order.asc("displayOrder").nullsLast(), Sort.Order.asc("label")));
        return ResponseEntity.ok(ApiResponse.ok(service.search(category, search, status, pageable)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DropdownOptionResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(service.getById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DropdownOptionResponse>> create(
            @Valid @RequestBody DropdownOptionRequest req,
            @RequestParam(defaultValue = "false") boolean idempotent) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.create(req, idempotent)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<DropdownOptionResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody DropdownOptionRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Updated successfully", service.update(id, req)));
    }

    @PatchMapping("/{id}/toggle-status")
    public ResponseEntity<ApiResponse<DropdownOptionResponse>> toggleStatus(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Status updated", service.toggleStatus(id)));
    }
}
