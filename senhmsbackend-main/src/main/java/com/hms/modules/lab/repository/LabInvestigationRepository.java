package com.hms.modules.lab.repository;

import com.hms.modules.lab.entity.LabInvestigation;
import com.hms.modules.lab.enums.LabPriority;
import com.hms.modules.lab.enums.LabStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface LabInvestigationRepository extends JpaRepository<LabInvestigation, Long> {

    // ── Lab ID generation ─────────────────────────────────────────────────────
    @Query("""
        SELECT COALESCE(MAX(CAST(SUBSTRING(l.labId, 16) AS int)), 0)
        FROM LabInvestigation l
        WHERE l.labId LIKE CONCAT('LAB-', :datePrefix, '-%')
    """)
    Integer findMaxLabSeqForDate(@Param("datePrefix") String datePrefix);

    // ── By patient / admission / visit ────────────────────────────────────────
    List<LabInvestigation> findByPatientIdOrderByOrderedDateDescOrderedTimeDesc(Long patientId);

    List<LabInvestigation> findByAdmissionIdOrderByOrderedDateDescOrderedTimeDesc(Long admissionId);

    /** All labs for a patient ordered in a date range, where billedInBillId IS NULL */
    @Query("""
        SELECT l FROM LabInvestigation l
        WHERE l.patientId    = :patientId
          AND l.admissionId IS NULL
          AND l.orderedDate >= :from
          AND l.orderedDate <= :to
        ORDER BY l.orderedDate ASC, l.orderedTime ASC
    """)
    List<LabInvestigation> findUnlinkedLabsForPatientInWindow(
            @Param("patientId") Long patientId,
            @Param("from") java.time.LocalDate from,
            @Param("to")   java.time.LocalDate to);

    List<LabInvestigation> findByVisitIdOrderByOrderedDateDescOrderedTimeDesc(Long visitId);

    // ── Order groups (estimation / collection flow) ───────────────────────────

    /** All tests in one order group, ordered for stable display. */
    List<LabInvestigation> findByOrderGroupIdOrderByIdAsc(String orderGroupId);

    /** All tests stamped into a given bill (used to flip them PAID on payment). */
    List<LabInvestigation> findByBilledInBillId(Long billId);

    /**
     * All non-cancelled lab tests ordered within a date range, most-recent first,
     * for the grouped collection screen. Grouping into orders happens in the service.
     */
    @Query("""
        SELECT l FROM LabInvestigation l
        WHERE l.status <> com.hms.modules.lab.enums.LabStatus.CANCELLED
          AND (:dateFrom IS NULL OR l.orderedDate >= :dateFrom)
          AND (:dateTo   IS NULL OR l.orderedDate <= :dateTo)
        ORDER BY l.orderedDate DESC, l.orderedTime DESC, l.id DESC
    """)
    List<LabInvestigation> findForCollection(@Param("dateFrom") LocalDate dateFrom,
                                             @Param("dateTo")   LocalDate dateTo);

    // ── Stats ─────────────────────────────────────────────────────────────────
    long countByStatus(LabStatus status);

    long countByStatusAndPriority(LabStatus status, LabPriority priority);

    // ── Paginated search ──────────────────────────────────────────────────────
    @Query("""
        SELECT l FROM LabInvestigation l
        WHERE (:search IS NULL
               OR LOWER(l.patientName)        LIKE LOWER(CONCAT('%',:search,'%'))
               OR LOWER(l.uhid)               LIKE LOWER(CONCAT('%',:search,'%'))
               OR LOWER(l.labId)              LIKE LOWER(CONCAT('%',:search,'%'))
               OR LOWER(l.investigationName)  LIKE LOWER(CONCAT('%',:search,'%')))
        AND (:status   IS NULL OR l.status   = :status)
        AND (:priority IS NULL OR l.priority = :priority)
        AND (:category IS NULL OR LOWER(l.category) = LOWER(:category))
        AND (:doctorId IS NULL OR l.doctorId = :doctorId)
        AND (:dateFrom IS NULL OR l.orderedDate >= :dateFrom)
        AND (:dateTo   IS NULL OR l.orderedDate <= :dateTo)
    """)
    Page<LabInvestigation> search(@Param("search")   String search,
                                  @Param("status")   LabStatus status,
                                  @Param("priority") LabPriority priority,
                                  @Param("category") String category,
                                  @Param("doctorId") Long doctorId,
                                  @Param("dateFrom") LocalDate dateFrom,
                                  @Param("dateTo")   LocalDate dateTo,
                                  Pageable pageable);
}
