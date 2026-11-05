package com.hms.common;

import com.hms.masters.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Writes a row to {@code audit_log} for every significant write operation.
 * Runs in its own transaction so an audit failure never rolls back the caller.
 *
 * NOTE: The {@code old_data} and {@code new_data} columns are declared as
 * {@code JSON} in MySQL, so every value stored must be valid JSON.
 * This service wraps all plain-text values as JSON objects before persisting.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    /**
     * @param entityType  e.g. "Patient", "Admission", "Bill"
     * @param entityId    PK of the affected row (null for non-row actions)
     * @param action      "CREATE" | "UPDATE" | "DELETE" | "DISCHARGE" | "TRANSFER" | "LOGIN" | …
     * @param performedBy username / email of the acting user (from SecurityContext)
     * @param details     free-text summary of what changed
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(String entityType,
                    Long   entityId,
                    String action,
                    String performedBy,
                    String details) {
        try {
            AuditLog entry = AuditLog.builder()
                    .entityType(entityType)
                    .entityId(entityId)
                    .action(action)
                    // Both columns are JSON type in MySQL — must store valid JSON
                    .oldData(toJson(performedBy))
                    .newData(toJson(details))
                    .build();
            auditLogRepository.save(entry);
            log.debug("[AUDIT] {}.{} id={} by={} | {}",
                    entityType, action, entityId, performedBy, details);
        } catch (Exception ex) {
            // audit must never break business flow
            log.warn("[AUDIT] Failed to write audit log: {}", ex.getMessage());
        }
    }

    /**
     * Overload that accepts a resolved {@link User} entity.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(String entityType,
                    Long   entityId,
                    String action,
                    User   user,
                    String details) {
        log(entityType, entityId, action,
                user != null ? user.getEmail() : "system", details);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    /**
     * Converts a plain string to a minimal JSON object so MySQL's JSON column
     * accepts it without truncation errors.
     *
     * Examples:
     *   "admin@hms.com"   →  {"value":"admin@hms.com"}
     *   "role=ADMIN"      →  {"value":"role=ADMIN"}
     *   null              →  null  (stored as SQL NULL)
     */
    private String toJson(String value) {
        if (value == null) return null;
        // Escape any double-quotes or backslashes inside the value
        String escaped = value.replace("\\", "\\\\").replace("\"", "\\\"");
        return "{\"value\":\"" + escaped + "\"}";
    }
}
