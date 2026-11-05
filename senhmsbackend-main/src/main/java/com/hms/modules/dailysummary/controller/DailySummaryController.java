package com.hms.modules.dailysummary.controller;

import com.hms.common.ApiResponse;
import com.hms.modules.dailysummary.dto.DailySummaryResponse;
import com.hms.modules.dailysummary.dto.DailySummaryResponse.ManualEntryResponse;
import com.hms.modules.dailysummary.dto.ManualEntryRequest;
import com.hms.modules.dailysummary.service.DailySummaryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/daily-summary")
@RequiredArgsConstructor
public class DailySummaryController {

    private final DailySummaryService service;

    /**
     * Full daily summary — aggregates bills, insurance claims, expenses, manual entries.
     * GET /api/daily-summary?date=2026-08-24
     * Defaults to today if date not provided.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<DailySummaryResponse>> getSummary(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        LocalDate targetDate = date != null ? date : LocalDate.now();
        return ResponseEntity.ok(ApiResponse.ok(service.getSummary(targetDate)));
    }

    /**
     * Add a manual cash collection entry.
     * POST /api/daily-summary/entries
     */
    @PostMapping("/entries")
    public ResponseEntity<ApiResponse<ManualEntryResponse>> addEntry(
            @Valid @RequestBody ManualEntryRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.addManualEntry(req)));
    }

    /**
     * Update a manual entry.
     * PUT /api/daily-summary/entries/{id}
     */
    @PutMapping("/entries/{id}")
    public ResponseEntity<ApiResponse<ManualEntryResponse>> updateEntry(
            @PathVariable Long id,
            @Valid @RequestBody ManualEntryRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Updated",
                service.updateManualEntry(id, req)));
    }

    /**
     * Delete a manual entry.
     * DELETE /api/daily-summary/entries/{id}
     */
    @DeleteMapping("/entries/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteEntry(@PathVariable Long id) {
        service.deleteManualEntry(id);
        return ResponseEntity.ok(ApiResponse.ok("Deleted", null));
    }

    /**
     * Lock/submit the day's summary (prevents further edits).
     * PATCH /api/daily-summary/2026-08-24/submit?submittedBy=Admin
     */
    @PatchMapping("/{date}/submit")
    public ResponseEntity<ApiResponse<Void>> submit(
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(defaultValue = "System") String submittedBy) {
        service.submit(date, submittedBy);
        return ResponseEntity.ok(ApiResponse.ok("Daily summary submitted", null));
    }
}
