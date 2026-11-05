package com.hms.modules.lab.controller;

import com.hms.common.ApiResponse;
import com.hms.common.PagedResponse;
import com.hms.modules.lab.dto.*;
import com.hms.modules.lab.enums.LabPriority;
import com.hms.modules.lab.enums.LabStatus;
import com.hms.modules.lab.service.FileStorageService;
import com.hms.modules.lab.service.LabService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.PathResource;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/lab/investigations")
@RequiredArgsConstructor
public class LabController {

    private final LabService service;
    private final FileStorageService fileStorageService;

    /**
     * Paginated search with filters.
     * GET /api/lab/investigations?search=CBC&status=PENDING&priority=STAT&page=0&size=20
     */
    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<LabInvestigationResponse>>> search(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) LabStatus status,
            @RequestParam(required = false) LabPriority priority,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Long doctorId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {

        // Newest order first: sort by ordered date, then time, then id — all
        // DESC. orderedDate alone only resolves to the day, so same-day orders
        // need orderedTime (and id as a final tiebreaker) to keep the latest
        // order at the top. Matches the recency ordering used by the other
        // lab finders (…OrderByOrderedDateDescOrderedTimeDesc).
        var pageable = PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "orderedDate", "orderedTime", "id"));
        return ResponseEntity.ok(ApiResponse.ok(
                new PagedResponse<>(service.search(search, status, priority,
                        category, doctorId, dateFrom, dateTo, pageable))));
    }

    /**
     * Single investigation by id.
     * GET /api/lab/investigations/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<LabInvestigationResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(service.getById(id)));
    }

    /**
     * All investigations for a patient.
     * GET /api/lab/investigations/patient/{patientId}
     */
    @GetMapping("/patient/{patientId}")
    public ResponseEntity<ApiResponse<List<LabInvestigationResponse>>> getByPatient(
            @PathVariable Long patientId) {
        return ResponseEntity.ok(ApiResponse.ok(service.getByPatient(patientId)));
    }

    /**
     * All investigations for an admission (case sheet).
     * GET /api/lab/investigations/admission/{admissionId}
     */
    @GetMapping("/admission/{admissionId}")
    public ResponseEntity<ApiResponse<List<LabInvestigationResponse>>> getByAdmission(
            @PathVariable Long admissionId) {
        return ResponseEntity.ok(ApiResponse.ok(service.getByAdmission(admissionId)));
    }

    /**
     * UNBILLED lab order groups for an admission — IP lab orders not yet folded
     * into a bill. The Bills page renders these as virtual sub-rows (keyed by
     * orderGroupId, since IP labs have no separate Bill) with a Pay action that
     * records a "Lab" receipt against the admission's main IP bill.
     * GET /api/lab/investigations/admission/{admissionId}/unbilled-orders
     */
    @GetMapping("/admission/{admissionId}/unbilled-orders")
    public ResponseEntity<ApiResponse<List<LabOrderGroupResponse>>> getUnbilledOrdersForAdmission(
            @PathVariable Long admissionId) {
        return ResponseEntity.ok(ApiResponse.ok(
                service.getUnbilledOrderGroupsForAdmission(admissionId)));
    }

    /**
     * All investigations for an OP visit.
     * GET /api/lab/investigations/visit/{visitId}
     */
    @GetMapping("/visit/{visitId}")
    public ResponseEntity<ApiResponse<List<LabInvestigationResponse>>> getByVisit(
            @PathVariable Long visitId) {
        return ResponseEntity.ok(ApiResponse.ok(service.getByVisit(visitId)));
    }

    // ── Order groups (pharmacy-style collection + estimation) ─────────────────

    /**
     * Grouped order list for the collection screen — one row per order group.
     * GET /api/lab/investigations/orders?dateFrom=&dateTo=
     */
    @GetMapping("/orders")
    public ResponseEntity<ApiResponse<List<LabOrderGroupResponse>>> getOrderGroups(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo) {
        return ResponseEntity.ok(ApiResponse.ok(service.getOrderGroups(dateFrom, dateTo)));
    }

    /**
     * Single order group by its group id.
     * GET /api/lab/investigations/orders/{groupId}
     */
    @GetMapping("/orders/{groupId}")
    public ResponseEntity<ApiResponse<LabOrderGroupResponse>> getOrderGroup(
            @PathVariable String groupId) {
        return ResponseEntity.ok(ApiResponse.ok(service.getOrderGroup(groupId)));
    }

    /**
     * Generate an estimation for an order group: re-prices from the lab master,
     * creates one bill for the admission/visit, and flips the group to
     * AWAITING_PAYMENT.
     * POST /api/lab/investigations/orders/{groupId}/estimate
     */
    @PostMapping("/orders/{groupId}/estimate")
    public ResponseEntity<ApiResponse<LabOrderGroupResponse>> generateEstimation(
            @PathVariable String groupId,
            @RequestBody(required = false) LabEstimateRequest req) {
        String by = (req != null && req.getGeneratedBy() != null) ? req.getGeneratedBy() : "system";
        return ResponseEntity.ok(ApiResponse.ok("Estimation generated",
                service.generateEstimation(groupId, by)));
    }

    /**
     * Place a new lab order (supports multiple tests in one request).
     * POST /api/lab/investigations
     */
    @PostMapping
    public ResponseEntity<ApiResponse<List<LabInvestigationResponse>>> order(
            @Valid @RequestBody LabOrderRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.order(req)));
    }

    /**
     * Collect sample — moves test from PENDING → IN_PROGRESS.
     * PATCH /api/lab/investigations/{id}/collect
     */
    @PatchMapping("/{id}/collect")
    public ResponseEntity<ApiResponse<LabInvestigationResponse>> collectSample(
            @PathVariable Long id,
            @Valid @RequestBody LabCollectRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Sample collected",
                service.collectSample(id, req)));
    }

    /**
     * Enter result — moves test from IN_PROGRESS → COMPLETED.
     * Auto-calculates TAT and abnormal flag.
     * PATCH /api/lab/investigations/{id}/result
     */
    @PatchMapping("/{id}/result")
    public ResponseEntity<ApiResponse<LabInvestigationResponse>> enterResult(
            @PathVariable Long id,
            @Valid @RequestBody LabResultRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Result entered",
                service.enterResult(id, req)));
    }

    /**
     * Cancel a test (PENDING or IN_PROGRESS only).
     * PATCH /api/lab/investigations/{id}/cancel
     */
    @PatchMapping("/{id}/cancel")
    public ResponseEntity<ApiResponse<LabInvestigationResponse>> cancel(
            @PathVariable Long id,
            @Valid @RequestBody LabCancelRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Test cancelled",
                service.cancel(id, req)));
    }

    // ── File upload ───────────────────────────────────────────────────────────

    /**
     * Upload a PDF report or an image for a lab investigation whose
     * resultType = PDF.  Can be called multiple times — each image is appended
     * to the images list; the PDF always replaces any previous PDF.
     *
     * POST /api/lab/investigations/{id}/upload
     *   multipart params:
     *     file     — the PDF or image file (required)
     *     type     — "pdf" | "image"  (required)
     *     completedBy — name of the lab tech (required for first upload that
     *                   completes the test)
     */
    @PostMapping(value = "/{id}/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<LabInvestigationResponse>> uploadFile(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            @RequestParam("type") String type,
            @RequestParam(value = "completedBy", required = false) String completedBy) {
        log.info("[LAB-UPLOAD] id={} type={} size={} completedBy={}", id, type, file.getSize(), completedBy);
        LabInvestigationResponse resp = service.attachFile(id, file, type, completedBy);
        return ResponseEntity.ok(ApiResponse.ok("File uploaded", resp));
    }

    // ── File serve ────────────────────────────────────────────────────────────

    /**
     * Stream a stored lab report file back to the client.
     * The filename is the last segment of the stored relative path.
     *
     * GET /api/lab/files/{filename}
     *
     * This endpoint is under /lab/** so it is covered by the existing
     * SecurityConfig rule:
     *   GET /lab/investigations/** → LAB_TECH, DOCTOR, etc.
     * We widen access to /lab/files/** with the same read-only roles.
     */
    @GetMapping(value = "/files/{filename:.+}", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public ResponseEntity<Resource> serveFile(@PathVariable String filename) {
        Path filePath = fileStorageService.resolve("lab-reports/" + filename);
        Resource resource = new PathResource(filePath);

        if (!resource.exists() || !resource.isReadable()) {
            return ResponseEntity.notFound().build();
        }

        String contentType;
        try {
            contentType = Files.probeContentType(filePath);
        } catch (IOException e) {
            contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
        }
        if (contentType == null) contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + filePath.getFileName() + "\"")
                .contentType(MediaType.parseMediaType(contentType))
                .body(resource);
    }
}
