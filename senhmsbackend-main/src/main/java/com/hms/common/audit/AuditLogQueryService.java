package com.hms.common.audit;

import com.hms.common.AuditLog;
import com.hms.common.AuditLogRepository;
import com.hms.masters.entity.User;
import com.hms.masters.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Read-only service that powers the Settings → Audit page.
 * Performs server-side filtering and pagination against {@code audit_log}
 * and maps rows into {@link AuditLogResponse}, unwrapping the JSON-wrapped
 * {@code old_data}/{@code new_data} values and resolving the performer's
 * email to their display name (username).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogQueryService {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    /**
     * Matches the JSON wrapper written by {@code AuditLogService}, tolerant of
     * MySQL's normalised spacing, e.g. {@code {"value": "admin@hms.com"}}.
     */
    private static final Pattern VALUE_JSON =
            Pattern.compile("^\\s*\\{\\s*\"value\"\\s*:\\s*\"(.*)\"\\s*}\\s*$", Pattern.DOTALL);

    /**
     * @param performedBy exact performer email, or null/blank for all users
     * @param fromDate    inclusive start date, or null for no lower bound
     * @param toDate      inclusive end date (the FULL day is included), or null
     */
    @Transactional(readOnly = true)
    public Page<AuditLogResponse> search(String performedBy,
                                         LocalDate fromDate,
                                         LocalDate toDate,
                                         Pageable pageable) {

        String performer = (performedBy == null || performedBy.isBlank())
                ? null : performedBy.trim();

        // Include the entire "to" day (created_at <= 23:59:59.999999 of that day).
        LocalDateTime fromDt = fromDate != null ? fromDate.atStartOfDay() : null;
        LocalDateTime toDt   = toDate   != null ? toDate.atTime(LocalTime.MAX) : null;

        Page<AuditLog> logs =
                auditLogRepository.searchLogs(performer, fromDt, toDt, pageable);

        // Resolve performer emails → display names in one batch for this page.
        List<String> emails = logs.getContent().stream()
                .map(a -> unwrap(a.getOldData()))
                .filter(e -> e != null && !e.isBlank())
                .distinct()
                .collect(Collectors.toList());

        Map<String, String> emailToName = emails.isEmpty()
                ? Map.of()
                : userRepository.findByEmailIgnoreCaseIn(emails).stream()
                        .collect(Collectors.toMap(
                                u -> u.getEmail().toLowerCase(),
                                User::getName,
                                (a, b) -> a));

        return logs.map(a -> toResponse(a, emailToName));
    }

    /**
     * Distinct performers for the filter dropdown, returned as display name +
     * email so the UI can show the username while still filtering by email.
     */
    @Transactional(readOnly = true)
    public List<AuditPerformer> distinctPerformers() {
        List<String> emails = auditLogRepository.findDistinctPerformers().stream()
                .filter(e -> e != null && !e.isBlank())
                .collect(Collectors.toList());

        Map<String, String> emailToName = emails.isEmpty()
                ? Map.of()
                : userRepository.findByEmailIgnoreCaseIn(emails).stream()
                        .collect(Collectors.toMap(
                                u -> u.getEmail().toLowerCase(),
                                User::getName,
                                (a, b) -> a));

        return emails.stream()
                .map(email -> new AuditPerformer(
                        email,
                        emailToName.getOrDefault(email.toLowerCase(), email)))
                .collect(Collectors.toList());
    }

    // ── mapping ─────────────────────────────────────────────────────────────

    private AuditLogResponse toResponse(AuditLog a, Map<String, String> emailToName) {
        String email = unwrap(a.getOldData());
        String name = email != null
                ? emailToName.getOrDefault(email.toLowerCase(), email)
                : "system";
        return AuditLogResponse.builder()
                .id(a.getId())
                .createdAt(a.getCreatedAt())
                .performedBy(name)          // username (display name)
                .performedByEmail(email)    // keep email for reference
                .action(a.getAction())
                .entityType(a.getEntityType())
                .entityId(a.getEntityId())
                .details(unwrap(a.getNewData()))
                .ipAddress(a.getIpAddress())
                .userAgent(a.getUserAgent())
                .build();
    }

    /**
     * Unwraps the minimal JSON object {@code {"value":"..."}} written by
     * {@code AuditLogService} back into the plain string. Tolerates MySQL's
     * normalised spacing and falls back to the raw value if the shape differs.
     */
    private String unwrap(String json) {
        if (json == null || json.isBlank()) return null;
        Matcher m = VALUE_JSON.matcher(json);
        if (m.matches()) {
            // reverse the escaping done when writing
            return m.group(1).replace("\\\"", "\"").replace("\\\\", "\\");
        }
        return json.trim();
    }
}
