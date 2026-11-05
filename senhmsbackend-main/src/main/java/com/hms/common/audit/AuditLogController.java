package com.hms.common.audit;

import com.hms.common.ApiResponse;
import com.hms.common.PagedResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

/**
 * Settings → Audit endpoints. Restricted to the MANAGING_DIRECTOR role.
 *
 * Authorization is enforced here at the API layer (not just in the UI): every
 * handler calls {@link #requireManagingDirector()} before touching data, so a
 * non-MD user hitting these URLs directly gets a 403 and never receives any
 * audit-log rows.
 */
@RestController
@RequestMapping("/audit-logs")
@RequiredArgsConstructor
public class AuditLogController {

    private static final String MD_AUTHORITY = "ROLE_MANAGING_DIRECTOR";

    private final AuditLogQueryService service;

    /**
     * GET /api/audit-logs
     * Optional query params: user (performer email), fromDate, toDate (yyyy-MM-dd),
     * page, size. Filters combine (AND). Results are newest-first and paginated.
     */
    @GetMapping
    public ResponseEntity<ApiResponse<PagedResponse<AuditLogResponse>>> search(
            @RequestParam(required = false) String user,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size) {

        requireManagingDirector();

        if (fromDate != null && toDate != null && fromDate.isAfter(toDate)) {
            throw new IllegalArgumentException("From Date cannot be later than To Date");
        }

        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(ApiResponse.ok(
                new PagedResponse<>(service.search(user, fromDate, toDate, pageable))));
    }

    /**
     * GET /api/audit-logs/users
     * Distinct performer emails that appear in the audit log, for the filter.
     */
    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<AuditPerformer>>> performers() {
        requireManagingDirector();
        return ResponseEntity.ok(ApiResponse.ok(service.distinctPerformers()));
    }

    // ── authorization guard ─────────────────────────────────────────────────

    private void requireManagingDirector() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isMd = auth != null && auth.isAuthenticated()
                && auth.getAuthorities().stream()
                        .map(GrantedAuthority::getAuthority)
                        .anyMatch(MD_AUTHORITY::equals);
        if (!isMd) {
            throw new AccessDeniedException(
                    "Access denied. Audit logs are restricted to the Managing Director.");
        }
    }
}
