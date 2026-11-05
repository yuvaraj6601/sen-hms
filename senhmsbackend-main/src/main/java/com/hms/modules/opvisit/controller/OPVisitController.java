package com.hms.modules.opvisit.controller;

import com.hms.common.ApiResponse;
import com.hms.common.PagedResponse;
import com.hms.modules.opvisit.dto.*;
import com.hms.modules.opvisit.enums.OPVisitStatus;
import com.hms.modules.opvisit.service.OPVisitService;
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
@RequestMapping("/op-visits")
@RequiredArgsConstructor
public class OPVisitController {

    private final OPVisitService service;

    /**
     * Get today's (or any date's) queue — main page load.
     * Used by the OP Token Queue table.
     */
    @GetMapping("/queue")
    public ResponseEntity<ApiResponse<List<OPVisitResponse>>> getQueue(
            @RequestParam(required = false)
                @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String doctorId,
            @RequestParam(required = false) OPVisitStatus status) {

        LocalDate queueDate = date != null ? date : LocalDate.now();
        return ResponseEntity.ok(ApiResponse.ok(
                service.getQueue(queueDate, search, doctorId, status)));
    }

    /**
     * Queue stats for the stat cards at the top of the page.
     */
    @GetMapping("/queue/stats")
    public ResponseEntity<ApiResponse<QueueStatsResponse>> getStats(
            @RequestParam(required = false)
                @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {

        LocalDate queueDate = date != null ? date : LocalDate.now();
        return ResponseEntity.ok(ApiResponse.ok(service.getStats(queueDate)));
    }

    /**
     * Paginated search across all dates — for history view.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<OPVisitResponse>>> search(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String doctorId,
            @RequestParam(required = false) OPVisitStatus status,
            @RequestParam(required = false)
                @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false)
                @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {

        var pageable = PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "visitDate").and(Sort.by("tokenNo")));
        return ResponseEntity.ok(ApiResponse.ok(
                new PagedResponse<>(service.search(search, doctorId, status,
                        dateFrom, dateTo, pageable))));
    }

    /**
     * Single visit detail.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<OPVisitResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(service.getById(id)));
    }

    /**
     * Patient visit history by UHID.
     */
    @GetMapping("/patient/{uhid}/history")
    public ResponseEntity<ApiResponse<List<OPVisitResponse>>> getPatientHistory(
            @PathVariable String uhid) {
        return ResponseEntity.ok(ApiResponse.ok(service.getPatientHistory(uhid)));
    }

    /**
     * Distinct area values from all OP visits — used to populate the area dropdown.
     */
    @GetMapping("/distinct-areas")
    public ResponseEntity<ApiResponse<List<String>>> getDistinctAreas() {
        return ResponseEntity.ok(ApiResponse.ok(service.getDistinctAreas()));
    }

    /**
     * Distinct district values from all OP visits — used to populate the district dropdown.
     */
    @GetMapping("/distinct-districts")
    public ResponseEntity<ApiResponse<List<String>>> getDistinctDistricts() {
        return ResponseEntity.ok(ApiResponse.ok(service.getDistinctDistricts()));
    }

    /**
     * Add patient to queue (auto-assigns token number).
     */
    @PostMapping
    public ResponseEntity<ApiResponse<OPVisitResponse>> create(
            @Valid @RequestBody OPVisitRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.create(req)));
    }

    /**
     * Public QR self-registration — no JWT required.
     * Patient fills the QR form; creates an OPVisit with registrationSource = VS.
     */
    @PostMapping("/self-register")
    public ResponseEntity<ApiResponse<OPVisitResponse>> selfRegister(
            @Valid @RequestBody SelfRegisterRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.selfRegister(req)));
    }

    /**
     * Advance visit status:
     *   WAITING → IN_CONSULTATION → CONSULTATION_DONE → BILLED → PAID
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<OPVisitResponse>> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody OPVisitStatusRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Status updated",
                service.updateStatus(id, req)));
    }

    /**
     * Edit the token-time payment (consultation amount, discount, collected
     * amount, split, mode) of an existing OP slip. Used to apply a discount /
     * mark a consultation free after the slip was generated.
     */
    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<OPVisitResponse>> edit(
            @PathVariable Long id,
            @Valid @RequestBody OPVisitEditRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("OP token updated",
                service.edit(id, req)));
    }
}
