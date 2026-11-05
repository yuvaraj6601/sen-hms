package com.hms.modules.billing.controller;

import com.hms.common.ApiResponse;
import com.hms.common.PagedResponse;
import com.hms.modules.billing.dto.*;
import com.hms.modules.billing.enums.BillStatus;
import com.hms.modules.billing.service.BillingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/bills")
@RequiredArgsConstructor
public class BillingController {

    private final BillingService service;

    /**
     * Paginated search with filters.
     * GET /api/bills?search=Ravi&status=PENDING&patientType=IP&insurance=true
     */
    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<BillResponse>>> search(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) BillStatus status,
            @RequestParam(required = false) String patientType,
            @RequestParam(required = false) Boolean insurance,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {

        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "date"));
        return ResponseEntity.ok(ApiResponse.ok(
                new PagedResponse<>(service.search(search, status, patientType,
                        insurance, dateFrom, dateTo, pageable))));
    }

    /** GET /api/bills/{id} */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<BillResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(service.getById(id)));
    }

    /** GET /api/bills/patient/{patientId} */
    @GetMapping("/patient/{patientId}")
    public ResponseEntity<ApiResponse<List<BillResponse>>> getByPatient(
            @PathVariable Long patientId) {
        return ResponseEntity.ok(ApiResponse.ok(service.getByPatient(patientId)));
    }

    /** GET /api/bills/admission/{admissionId} */
    @GetMapping("/admission/{admissionId}")
    public ResponseEntity<ApiResponse<List<BillResponse>>> getByAdmission(
            @PathVariable Long admissionId) {
        return ResponseEntity.ok(ApiResponse.ok(service.getByAdmission(admissionId)));
    }

    /**
     * Distinct patient IDs that have at least one non-cancelled bill.
     * GET /api/bills/patient-ids-with-bills
     * Lets the patient list show "View Bill" vs "Generate Bill" in one request.
     */
    @GetMapping("/patient-ids-with-bills")
    public ResponseEntity<ApiResponse<List<Long>>> patientIdsWithBills() {
        return ResponseEntity.ok(ApiResponse.ok(service.getPatientIdsWithBills()));
    }

    /**
     * Create bill (Draft or immediate).
     * POST /api/bills
     */
    @PostMapping
    public ResponseEntity<ApiResponse<BillResponse>> create(
            @Valid @RequestBody BillRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.create(req)));
    }

    /**
     * Collect Cash — record an advance / settlement / refund receipt against the
     * admission's single bill (creating a DRAFT bill if none exists yet).
     * POST /api/bills/collect
     */
    @PostMapping("/collect")
    public ResponseEntity<ApiResponse<BillResponse>> collect(
            @Valid @RequestBody CollectRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.ok("Receipt recorded", service.collect(req)));
    }

    /**
     * Update bill (Draft / Pending only).
     * PUT /api/bills/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<BillResponse>> update(
            @PathVariable Long id,
            @Valid @RequestBody BillRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Updated successfully", service.update(id, req)));
    }

    /**
     * Record a payment against a bill.
     * PATCH /api/bills/{id}/payment
     */
    @PatchMapping("/{id}/payment")
    public ResponseEntity<ApiResponse<BillResponse>> recordPayment(
            @PathVariable Long id,
            @Valid @RequestBody PaymentRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Payment recorded", service.recordPayment(id, req)));
    }

    /**
     * Cancel a bill.
     * PATCH /api/bills/{id}/cancel
     */
    @PatchMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<BillResponse>> cancel(
            @PathVariable Long id,
            @Valid @RequestBody CancelBillRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Bill cancelled", service.cancel(id, req)));
    }

    /**
     * Close (finalise) an IP bill — marks it PAID, cannot be undone.
     * After closing, the patient's Discharge Summary becomes accessible.
     * PATCH /api/bills/{id}/close
     */
    @PatchMapping("/{id}/close")
    public ResponseEntity<ApiResponse<BillResponse>> closeBill(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok("Bill closed", service.closeBill(id)));
    }

    /**
     * Update insurance claim details.
     * PATCH /api/bills/{id}/insurance
     */
    @PatchMapping("/{id}/insurance")
    public ResponseEntity<ApiResponse<BillResponse>> updateInsurance(
            @PathVariable Long id,
            @Valid @RequestBody InsuranceUpdateRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Insurance updated", service.updateInsurance(id, req)));
    }

    /**
     * Lock the bill to the insurer's approved amount — writes off the remaining
     * gap (collected in hand, off-record) and closes the bill as PAID.
     * PATCH /api/bills/{id}/lock-insurance
     */
    @PatchMapping("/{id}/lock-insurance")
    public ResponseEntity<ApiResponse<BillResponse>> lockToInsuranceApproved(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(
                "Bill locked to insurance approved amount", service.lockToInsuranceApproved(id)));
    }

    /**
     * Admin-only: reopen a bill that was locked to the insurance approved amount.
     * PATCH /api/bills/{id}/reopen-insurance
     */
    @PatchMapping("/{id}/reopen-insurance")
    public ResponseEntity<ApiResponse<BillResponse>> reopenInsuranceLocked(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(
                "Bill reopened", service.reopenInsuranceLocked(id)));
    }

    /**
     * Auto-generate draft bill items from an admission.
     * GET /api/bills/prefill?admissionId=123
     * Returns ward charge segments + unbilled lab tests. All items are editable before saving.
     */
    @GetMapping("/prefill")
    public ResponseEntity<ApiResponse<BillPrefillResponse>> prefill(
            @RequestParam Long admissionId) {
        return ResponseEntity.ok(ApiResponse.ok(service.prefill(admissionId)));
    }

    /**
     * Generate a consolidated IP bill by merging an admission's selected bills
     * into one. Source bills are marked CONSOLIDATED; any prior consolidated
     * bill is superseded. Cash patients must have all bills fully paid.
     * POST /api/bills/consolidate
     */
    @PostMapping("/consolidate")
    public ResponseEntity<ApiResponse<List<BillResponse>>> consolidate(
            @Valid @RequestBody ConsolidateBillRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.consolidate(req)));
    }
}
