package com.hms.masters.controller;

import com.hms.common.ApiResponse;
import com.hms.common.PagedResponse;
import com.hms.masters.dto.DoctorRequest;
import com.hms.masters.dto.DoctorResponse;
import com.hms.masters.enums.DoctorStatus;
import com.hms.masters.service.DoctorService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/masters/doctors")
@RequiredArgsConstructor
public class DoctorController {

    private final DoctorService service;

    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<DoctorResponse>>> search(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) DoctorStatus status,
            @RequestParam(required = false) Long departmentId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        var pageable = PageRequest.of(page, size, Sort.by("name"));
        return ResponseEntity.ok(ApiResponse.ok(
                new PagedResponse<>(service.search(search, status, departmentId, pageable))));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DoctorResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(service.getById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DoctorResponse>> create(
            @Valid @RequestBody DoctorRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.create(req)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<DoctorResponse>> update(
            @PathVariable Long id, @Valid @RequestBody DoctorRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Updated successfully", service.update(id, req)));
    }

    @PatchMapping("/{id}/toggle-status")
    public ResponseEntity<ApiResponse<DoctorResponse>> toggleStatus(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Status updated", service.toggleStatus(id)));
    }
}
