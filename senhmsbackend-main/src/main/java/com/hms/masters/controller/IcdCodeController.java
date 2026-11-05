package com.hms.masters.controller;

import com.hms.common.ApiResponse;
import com.hms.common.PagedResponse;
import com.hms.masters.dto.IcdCodeRequest;
import com.hms.masters.dto.IcdCodeResponse;
import com.hms.masters.enums.IcdCodeType;
import com.hms.masters.enums.Status;
import com.hms.masters.service.IcdCodeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * ICD / PCS Code Master
 * Base path: /api/masters/icd-codes
 *
 * Supports both ICD-10-CM (diagnosis) and ICD-10-PCS (procedure) codes.
 * Fields: complaint, icdCode, description, codeType
 */
@RestController
@RequestMapping("/masters/icd-codes")
@RequiredArgsConstructor
public class IcdCodeController {

    private final IcdCodeService service;

    /** Paginated search — used by the master list page */
    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<IcdCodeResponse>>> search(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) IcdCodeType codeType,
            @RequestParam(required = false) Status status,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {

        var pageable = PageRequest.of(page, size, Sort.by("icdCode"));
        return ResponseEntity.ok(ApiResponse.ok(service.search(search, codeType, status, pageable)));
    }

    /** Autocomplete endpoint — returns up to 20 matches for typeahead in forms */
    @GetMapping("/autocomplete")
    public ResponseEntity<ApiResponse<List<IcdCodeResponse>>> autocomplete(
            @RequestParam String q,
            @RequestParam(required = false) IcdCodeType codeType) {
        return ResponseEntity.ok(ApiResponse.ok(service.autocomplete(q, codeType)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<IcdCodeResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(service.getById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<IcdCodeResponse>> create(
            @Valid @RequestBody IcdCodeRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.create(req)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<IcdCodeResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody IcdCodeRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Updated successfully", service.update(id, req)));
    }

    @PatchMapping("/{id}/toggle-status")
    public ResponseEntity<ApiResponse<IcdCodeResponse>> toggleStatus(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Status updated", service.toggleStatus(id)));
    }
}
