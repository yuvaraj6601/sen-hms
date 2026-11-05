package com.hms.common.audit;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Read-model for a single audit-log row shown on the Settings → Audit page.
 *
 * Field mapping to the {@code audit_log} table:
 *   createdAt   → Date &amp; Time
 *   performedBy → User      (extracted from old_data JSON {"value":"email"})
 *   action      → Action
 *   entityType  → Module
 *   details     → Description (extracted from new_data JSON {"value":"..."})
 *   ipAddress   → IP Address
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLogResponse {

    private Long id;
    private LocalDateTime createdAt;
    /** Display name (username) of the acting user. */
    private String performedBy;
    /** Underlying email of the acting user (kept for reference/detail view). */
    private String performedByEmail;
    private String action;
    private String entityType;
    private Long entityId;
    private String details;
    private String ipAddress;
    private String userAgent;
}
