package com.hms.modules.feedback.controller;

import com.hms.common.ApiResponse;
import com.hms.common.PagedResponse;
import com.hms.modules.feedback.dto.FeedbackRequest;
import com.hms.modules.feedback.dto.FeedbackResponse;
import com.hms.modules.feedback.dto.FeedbackSummaryResponse;
import com.hms.modules.feedback.service.FeedbackService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

/**
 * NABH patient-satisfaction feedback.
 *
 * <ul>
 *   <li>POST /feedback/submit — PUBLIC (QR form, no JWT). See SecurityConfig.</li>
 *   <li>GET  /feedback        — staff list (authenticated).</li>
 *   <li>GET  /feedback/{id}   — staff detail / report source (authenticated).</li>
 * </ul>
 */
@RestController
@RequestMapping("/feedback")
@RequiredArgsConstructor
public class FeedbackController {

    private final FeedbackService service;

    /**
     * Public submission from the patient's phone via the QR form.
     * POST /api/feedback/submit
     */
    @PostMapping("/submit")
    public ResponseEntity<ApiResponse<FeedbackResponse>> submit(
            @Valid @RequestBody FeedbackRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.created(service.submit(req)));
    }

    /**
     * Paginated staff list. Optional name/mobile search and createdAt range.
     * GET /api/feedback?search=&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&page=0&size=20
     */
    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<FeedbackSummaryResponse>>> search(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "20") int size) {

        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return ResponseEntity.ok(ApiResponse.ok(
                new PagedResponse<>(service.search(search, dateFrom, dateTo, pageable))));
    }

    /**
     * Full feedback record (all 18 answers + comments) for the detail view
     * and the printable NABH report.
     * GET /api/feedback/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<FeedbackResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.ok(service.getById(id)));
    }
}
