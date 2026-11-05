package com.hms.common;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface AuditLogRepository
        extends JpaRepository<AuditLog, Long> {

    /**
     * Filtered, paginated audit-log lookup.
     *
     * The performing user's email is stored inside the {@code old_data} JSON
     * column as {@code {"value":"user@email"}} (see {@link AuditLogService}).
     * We extract it with MySQL's {@code JSON_UNQUOTE(JSON_EXTRACT(...))} so the
     * user filter can match on the real email.
     *
     * Results are ordered newest-first. All filters are optional — a null value
     * means "do not filter on this field".
     *
     * @param performedBy exact performer email (null = all users)
     * @param fromDt      inclusive lower bound on created_at (null = no lower bound)
     * @param toDt        inclusive upper bound on created_at (null = no upper bound)
     */
    @Query(value = """
            SELECT * FROM audit_log a
            WHERE (:performedBy IS NULL
                   OR JSON_UNQUOTE(JSON_EXTRACT(a.old_data, '$.value')) = :performedBy)
              AND (:fromDt IS NULL OR a.created_at >= :fromDt)
              AND (:toDt   IS NULL OR a.created_at <= :toDt)
            ORDER BY a.created_at DESC, a.id DESC
            """,
            countQuery = """
            SELECT COUNT(*) FROM audit_log a
            WHERE (:performedBy IS NULL
                   OR JSON_UNQUOTE(JSON_EXTRACT(a.old_data, '$.value')) = :performedBy)
              AND (:fromDt IS NULL OR a.created_at >= :fromDt)
              AND (:toDt   IS NULL OR a.created_at <= :toDt)
            """,
            nativeQuery = true)
    Page<AuditLog> searchLogs(@Param("performedBy") String performedBy,
                              @Param("fromDt") LocalDateTime fromDt,
                              @Param("toDt") LocalDateTime toDt,
                              Pageable pageable);

    /**
     * Distinct performer emails that actually appear in the audit log — used to
     * populate the User filter dropdown so it only lists users who have activity.
     */
    @Query(value = """
            SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(a.old_data, '$.value')) AS performer
            FROM audit_log a
            WHERE JSON_UNQUOTE(JSON_EXTRACT(a.old_data, '$.value')) IS NOT NULL
            ORDER BY performer ASC
            """,
            nativeQuery = true)
    List<String> findDistinctPerformers();
}
