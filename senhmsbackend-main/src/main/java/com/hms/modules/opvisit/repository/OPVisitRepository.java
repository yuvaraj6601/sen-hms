package com.hms.modules.opvisit.repository;

import com.hms.modules.opvisit.entity.OPVisit;
import com.hms.modules.opvisit.enums.OPVisitStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface OPVisitRepository extends JpaRepository<OPVisit, Long> {

    // ── Token generation ───────────────────────────────────────────────────────
    /**
     * Max daily sequence for a given regType-prefixed token on a date.
     * Tokens look like CON-300926-001 — the last 3 chars are the sequence, so we
     * cast the trailing digits of matching tokens and take the max.
     * The {@code tokenPrefixLike} is "PREFIX-ddMMyy-%" (e.g. "CON-300926-%").
     */
    @Query("""
        SELECT COALESCE(MAX(CAST(SUBSTRING(v.tokenNo, LENGTH(v.tokenNo) - 2, 3) AS int)), 0)
        FROM OPVisit v
        WHERE v.visitDate = :date
          AND v.tokenNo LIKE :tokenPrefixLike
    """)
    Integer findMaxTokenSeqForDateAndPrefix(@Param("date") LocalDate date,
                                            @Param("tokenPrefixLike") String tokenPrefixLike);

    /** Max visit sequence for year-based visitNo generation. */
    @Query("SELECT COALESCE(MAX(CAST(SUBSTRING(v.visitNo, 10) AS int)), 0) FROM OPVisit v WHERE YEAR(v.visitDate) = :year")
    Integer findMaxSeqForYear(@Param("year") int year);

    // ── Queue stats ────────────────────────────────────────────────────────────
    long countByVisitDateAndStatus(LocalDate date, OPVisitStatus status);
    long countByVisitDate(LocalDate date);

    // ── Report aggregation (date range: from..to inclusive) ─────────────────────
    /** Total OP visits within a date range. */
    @Query("SELECT COUNT(v) FROM OPVisit v WHERE v.visitDate BETWEEN :from AND :to")
    long countInRange(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /** Free OP visits within a date range. */
    @Query("SELECT COUNT(v) FROM OPVisit v WHERE v.visitDate BETWEEN :from AND :to AND v.free = true")
    long countFreeInRange(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /**
     * Daily OP time-series over a range.
     * Returns rows [visitDate (LocalDate), totalCount, freeCount].
     * Only dates with at least one visit appear; the service fills gaps with zero.
     * Optional department filter (null = all).
     */
    @Query("""
        SELECT v.visitDate,
               COUNT(v),
               SUM(CASE WHEN v.free = true THEN 1 ELSE 0 END)
        FROM OPVisit v
        WHERE v.visitDate BETWEEN :from AND :to
          AND (:department IS NULL OR v.department = :department)
        GROUP BY v.visitDate
        ORDER BY v.visitDate
    """)
    List<Object[]> opDailySeries(@Param("from") LocalDate from,
                                 @Param("to") LocalDate to,
                                 @Param("department") String department);

    // ── Search / list ──────────────────────────────────────────────────────────
    @Query("""
        SELECT v FROM OPVisit v
        WHERE v.visitDate = :date
        AND (:search IS NULL
             OR LOWER(v.patientName) LIKE LOWER(CONCAT('%',:search,'%'))
             OR LOWER(v.uhid) LIKE LOWER(CONCAT('%',:search,'%'))
             OR LOWER(v.tokenNo) LIKE LOWER(CONCAT('%',:search,'%'))
             OR v.phone LIKE CONCAT('%',:search,'%'))
        AND (:doctorId IS NULL OR v.doctorId = :doctorId)
        AND (:status IS NULL OR v.status = :status)
        ORDER BY v.id DESC
    """)
    List<OPVisit> findQueueForDate(@Param("date") LocalDate date,
                                   @Param("search") String search,
                                   @Param("doctorId") String doctorId,
                                   @Param("status") OPVisitStatus status);

    @Query("""
        SELECT v FROM OPVisit v
        WHERE (:search IS NULL
               OR LOWER(v.patientName) LIKE LOWER(CONCAT('%',:search,'%'))
               OR LOWER(v.uhid) LIKE LOWER(CONCAT('%',:search,'%'))
               OR LOWER(v.tokenNo) LIKE LOWER(CONCAT('%',:search,'%')))
        AND (:doctorId IS NULL OR v.doctorId = :doctorId)
        AND (:status IS NULL OR v.status = :status)
        AND (:dateFrom IS NULL OR v.visitDate >= :dateFrom)
        AND (:dateTo IS NULL OR v.visitDate <= :dateTo)
    """)
    Page<OPVisit> search(@Param("search") String search,
                         @Param("doctorId") String doctorId,
                         @Param("status") OPVisitStatus status,
                         @Param("dateFrom") LocalDate dateFrom,
                         @Param("dateTo") LocalDate dateTo,
                         Pageable pageable);

    // ── Patient history ────────────────────────────────────────────────────────
    List<OPVisit> findByUhidOrderByVisitDateDesc(String uhid);

    /**
     * Bulk fetch of OP visits for a set of UHIDs — used to enrich the patient
     * list with the latest-visit info WITHOUT an N+1 query per patient. Rows are
     * ordered newest-first so the caller keeps the first row seen per UHID.
     * Returns projection rows: [uhid, visitNo, tokenNo, visitDate, status].
     */
    @Query("""
        SELECT v.uhid, v.visitNo, v.tokenNo, v.visitDate, v.status
        FROM OPVisit v
        WHERE v.uhid IN :uhids
        ORDER BY v.visitDate DESC, v.id DESC
    """)
    List<Object[]> findLatestVisitsForUhids(@Param("uhids") List<String> uhids);

    // ── Distinct area / district values (for dropdown suggestions) ─────────────
    @Query("SELECT DISTINCT v.area FROM OPVisit v WHERE v.area IS NOT NULL AND v.area <> '' ORDER BY v.area")
    List<String> findDistinctAreas();

    @Query("SELECT DISTINCT v.district FROM OPVisit v WHERE v.district IS NOT NULL AND v.district <> '' ORDER BY v.district")
    List<String> findDistinctDistricts();
}
