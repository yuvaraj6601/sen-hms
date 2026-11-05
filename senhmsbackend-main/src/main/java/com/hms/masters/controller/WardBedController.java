package com.hms.masters.controller;

import com.hms.common.ApiResponse;
import com.hms.masters.dto.BedRequest;
import com.hms.masters.dto.BedResponse;
import com.hms.masters.dto.WardRequest;
import com.hms.masters.dto.WardResponse;
import com.hms.masters.entity.Bed.BedStatus;
import com.hms.masters.service.WardBedService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/masters/wards")
@RequiredArgsConstructor
public class WardBedController {

    private final WardBedService service;

    // ── Wards ─────────────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<ApiResponse<List<WardResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.ok(service.getAllWards()));
    }

    @GetMapping("/active")
    public ResponseEntity<ApiResponse<List<WardResponse>>> getActive() {
        return ResponseEntity.ok(ApiResponse.ok(service.getActiveWards()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<WardResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(service.getWardById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<WardResponse>> create(@Valid @RequestBody WardRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.createWard(req)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<WardResponse>> update(
            @PathVariable Long id, @Valid @RequestBody WardRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Updated successfully", service.updateWard(id, req)));
    }

    @PatchMapping("/{id}/toggle-status")
    public ResponseEntity<ApiResponse<WardResponse>> toggleStatus(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Status updated", service.toggleWardStatus(id)));
    }

    // ── Beds ──────────────────────────────────────────────────────────────────

    @GetMapping("/{wardId}/beds")
    public ResponseEntity<ApiResponse<List<BedResponse>>> getBeds(@PathVariable Long wardId) {
        return ResponseEntity.ok(ApiResponse.ok(service.getBedsByWard(wardId)));
    }

    @GetMapping("/{wardId}/beds/available")
    public ResponseEntity<ApiResponse<List<BedResponse>>> getAvailableBeds(@PathVariable Long wardId) {
        return ResponseEntity.ok(ApiResponse.ok(service.getAvailableBedsByWard(wardId)));
    }

    @PatchMapping("/beds/{bedId}/status")
    public ResponseEntity<ApiResponse<BedResponse>> updateBedStatus(
            @PathVariable Long bedId,
            @RequestParam BedStatus status) {
        return ResponseEntity.ok(ApiResponse.ok("Bed status updated", service.updateBedStatus(bedId, status)));
    }

    @PostMapping("/beds")
    public ResponseEntity<ApiResponse<BedResponse>> addBed(@Valid @RequestBody BedRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.addBed(req)));
    }

    @DeleteMapping("/beds/{bedId}")
    public ResponseEntity<ApiResponse<Void>> deleteBed(@PathVariable Long bedId) {
        service.deleteBed(bedId);
        return ResponseEntity.ok(ApiResponse.ok("Bed deleted", null));
    }
}
