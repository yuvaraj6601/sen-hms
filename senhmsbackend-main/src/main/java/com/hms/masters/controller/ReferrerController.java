package com.hms.masters.controller;

import com.hms.common.ApiResponse;
import com.hms.common.PagedResponse;
import com.hms.masters.dto.ReferrerRequest;
import com.hms.masters.dto.ReferrerResponse;
import com.hms.masters.enums.ReferrerType;
import com.hms.masters.enums.Status;
import com.hms.masters.service.ReferrerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/masters/referrers")
@RequiredArgsConstructor
public class ReferrerController {

    private final ReferrerService service;

    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<ReferrerResponse>>> search(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) ReferrerType type,
            @RequestParam(required = false) Status status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        var pageable = PageRequest.of(page, size, Sort.by("name"));
        return ResponseEntity.ok(ApiResponse.ok(
                new PagedResponse<>(service.search(search, type, status, pageable))));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ReferrerResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(service.getById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ReferrerResponse>> create(@Valid @RequestBody ReferrerRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.create(req)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ReferrerResponse>> update(
            @PathVariable Long id, @Valid @RequestBody ReferrerRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Updated successfully", service.update(id, req)));
    }

    @PatchMapping("/{id}/toggle-status")
    public ResponseEntity<ApiResponse<ReferrerResponse>> toggleStatus(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Status updated", service.toggleStatus(id)));
    }
}
