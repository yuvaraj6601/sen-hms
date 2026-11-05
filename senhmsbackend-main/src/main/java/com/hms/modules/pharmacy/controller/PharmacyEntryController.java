package com.hms.modules.pharmacy.controller;

import com.hms.common.ApiResponse;
import com.hms.modules.pharmacy.dto.*;
import com.hms.modules.pharmacy.service.PharmacyEntryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/pharmacy")
@RequiredArgsConstructor
public class PharmacyEntryController {

    private final PharmacyEntryService service;

    // ── Entries ───────────────────────────────────────────────────────────────

    /** GET /pharmacy?date=2024-09-14  →  accounts with activity (open/payment/return) on that date */
    @GetMapping
    public ResponseEntity<ApiResponse<List<PharmacyEntryResponse>>> listByDate(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(ApiResponse.ok(service.listByDate(date)));
    }

    /** GET /pharmacy/search?name=raj&outstanding=true  →  find patient accounts by name */
    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<PharmacyEntryResponse>>> search(
            @RequestParam String name,
            @RequestParam(defaultValue = "false") boolean outstanding) {
        return ResponseEntity.ok(ApiResponse.ok(service.search(name, outstanding)));
    }

    /** POST /pharmacy  →  create a new purchase entry */
    @PostMapping
    public ResponseEntity<ApiResponse<PharmacyEntryResponse>> create(
            @Valid @RequestBody PharmacyEntryRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.create(req)));
    }

    /** PUT /pharmacy/{id}  →  edit an existing purchase entry */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<PharmacyEntryResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody PharmacyEntryRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Updated successfully", service.update(id, req)));
    }

    /** DELETE /pharmacy/{id}  →  delete a purchase entry (and all its returns) */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("Deleted successfully", null));
    }

    // ── Payments (child) ──────────────────────────────────────────────────────

    /** POST /pharmacy/{id}/payments  →  record a payment (advance or top-up) */
    @PostMapping("/{id}/payments")
    public ResponseEntity<ApiResponse<PharmacyPaymentResponse>> addPayment(
            @PathVariable Long id,
            @Valid @RequestBody PharmacyPaymentRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.addPayment(id, req)));
    }

    /** DELETE /pharmacy/{id}/payments/{pid}  →  delete a payment record */
    @DeleteMapping("/{id}/payments/{pid}")
    public ResponseEntity<ApiResponse<Void>> deletePayment(
            @PathVariable Long id,
            @PathVariable Long pid) {
        service.deletePayment(id, pid);
        return ResponseEntity.ok(ApiResponse.ok("Payment deleted", null));
    }

    // ── Returns (child) ───────────────────────────────────────────────────────

    /** POST /pharmacy/{id}/returns  →  add a return against a purchase */
    @PostMapping("/{id}/returns")
    public ResponseEntity<ApiResponse<PharmacyReturnResponse>> addReturn(
            @PathVariable Long id,
            @Valid @RequestBody PharmacyReturnRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.addReturn(id, req)));
    }

    /** DELETE /pharmacy/{id}/returns/{rid}  →  delete a return record */
    @DeleteMapping("/{id}/returns/{rid}")
    public ResponseEntity<ApiResponse<Void>> deleteReturn(
            @PathVariable Long id,
            @PathVariable Long rid) {
        service.deleteReturn(id, rid);
        return ResponseEntity.ok(ApiResponse.ok("Return deleted", null));
    }
}
