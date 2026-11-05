package com.hms.modules.admission.repository;

import com.hms.modules.admission.entity.Admission;
import com.hms.modules.admission.enums.AdmissionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AdmissionRepository extends JpaRepository<Admission, Long> {

    Optional<Admission> findByAdmissionNo(String admissionNo);

    boolean existsByAdmissionNo(String admissionNo);

    /** Active (non-discharged) admission for a patient — a patient should only have one at a time */
    @Query("""
        SELECT a FROM Admission a
        WHERE a.patientId = :patientId
        AND a.status <> 'DISCHARGED'
        ORDER BY a.admissionDate DESC
    """)
    Optional<Admission> findActiveByPatientId(@Param("patientId") Long patientId);

    /** All admissions for a patient, most recent first */
    List<Admission> findByPatientIdOrderByAdmissionDateDesc(Long patientId);

    /**
     * Bulk fetch of ACTIVE (non-discharged) admissions for a set of patient ids —
     * used to enrich the patient list with current-episode info WITHOUT an N+1
     * query per patient. Returns projection rows:
     * [patientId, admissionNo, admissionDate, wardName, bedNumber, status,
     *  isInsurance, insuranceStatus].
     * A patient should only have one active admission at a time; if duplicates
     * ever exist the caller keeps the first row seen.
     */
    @Query("""
        SELECT a.patientId, a.admissionNo, a.admissionDate, a.wardName, a.bedNumber, a.status,
               a.isInsurance, a.insuranceStatus, a.id
        FROM Admission a
        WHERE a.patientId IN :patientIds
          AND a.status <> 'DISCHARGED'
        ORDER BY a.admissionDate DESC
    """)
    List<Object[]> findActiveEpisodesForPatients(@Param("patientIds") List<Long> patientIds);

    /** All admissions for a UHID */
    List<Admission> findByUhidOrderByAdmissionDateDesc(String uhid);

    // ── Sequence for admission number generation ───────────────────────────────
    @Query("""
        SELECT COALESCE(MAX(CAST(SUBSTRING(a.admissionNo, 16) AS int)), 0)
        FROM Admission a
        WHERE a.admissionNo LIKE CONCAT('ADM-', :datePrefix, '-%')
    """)
    Integer findMaxAdmissionSeqForDate(@Param("datePrefix") String datePrefix);

    // ── Sequence for discharge number generation ───────────────────────────────
    @Query("""
        SELECT COALESCE(MAX(CAST(SUBSTRING(a.dischargeNo, 16) AS int)), 0)
        FROM Admission a
        WHERE a.dischargeNo LIKE CONCAT('DIS-', :datePrefix, '-%')
    """)
    Integer findMaxDischargeSeqForDate(@Param("datePrefix") String datePrefix);

    // ── Paginated search ───────────────────────────────────────────────────────
    @Query("""
        SELECT a FROM Admission a
        WHERE (:search IS NULL
               OR LOWER(a.patientName)  LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(a.uhid)         LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(a.admissionNo)  LIKE LOWER(CONCAT('%', :search, '%'))
               OR a.phone               LIKE CONCAT('%', :search, '%'))
        AND (:status IS NULL OR a.status = :status)
        AND (:admittingDoctorId IS NULL OR a.admittingDoctorId = :admittingDoctorId)
        AND (:wardId IS NULL OR a.wardId = :wardId)
        AND (:dateFrom IS NULL OR a.admissionDate >= :dateFrom)
        AND (:dateTo   IS NULL OR a.admissionDate <= :dateTo)
    """)
    Page<Admission> search(@Param("search")            String search,
                           @Param("status")            AdmissionStatus status,
                           @Param("admittingDoctorId") Long admittingDoctorId,
                           @Param("wardId")            Long wardId,
                           @Param("dateFrom")          LocalDate dateFrom,
                           @Param("dateTo")            LocalDate dateTo,
                           Pageable pageable);

    // ── Stats ──────────────────────────────────────────────────────────────────
    long countByStatus(AdmissionStatus status);

    long countByAdmissionDate(LocalDate date);

    // ── Report aggregation (date range: from..to inclusive) ─────────────────────
    /** Total admissions (IP) within a date range. */
    @Query("SELECT COUNT(a) FROM Admission a WHERE a.admissionDate BETWEEN :from AND :to")
    long countInRange(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /** Free admissions within a date range. */
    @Query("SELECT COUNT(a) FROM Admission a WHERE a.admissionDate BETWEEN :from AND :to AND a.free = true")
    long countFreeInRange(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /** Insurance admissions within a date range (paymentMode = INSURANCE or an insurance company is set). */
    @Query("""
        SELECT COUNT(a) FROM Admission a
        WHERE a.admissionDate BETWEEN :from AND :to
          AND (UPPER(a.paymentMode) = 'INSURANCE'
               OR (a.insuranceCompany IS NOT NULL AND a.insuranceCompany <> ''))
    """)
    long countInsuranceInRange(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /**
     * IP category counts within a date range, grouped by insurance flag.
     * Returns [isInsurance (boolean/int), count].
     * isInsurance = true when paymentMode = INSURANCE or insuranceCompany is set.
     */
    @Query("""
        SELECT (CASE WHEN (UPPER(a.paymentMode) = 'INSURANCE'
                          OR (a.insuranceCompany IS NOT NULL AND a.insuranceCompany <> ''))
                     THEN true ELSE false END) AS isInsurance,
               COUNT(a)
        FROM Admission a
        WHERE a.admissionDate BETWEEN :from AND :to
        GROUP BY (CASE WHEN (UPPER(a.paymentMode) = 'INSURANCE'
                          OR (a.insuranceCompany IS NOT NULL AND a.insuranceCompany <> ''))
                     THEN true ELSE false END)
    """)
    List<Object[]> categoryCountsInRange(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /**
     * IP counts within a range grouped by insurance × surgical.
     * Returns rows [isInsurance, isSurgical, count].
     */
    @Query("""
        SELECT (CASE WHEN (UPPER(a.paymentMode) = 'INSURANCE'
                          OR (a.insuranceCompany IS NOT NULL AND a.insuranceCompany <> ''))
                     THEN true ELSE false END) AS isInsurance,
               a.surgical AS isSurgical,
               COUNT(a)
        FROM Admission a
        WHERE a.admissionDate BETWEEN :from AND :to
        GROUP BY (CASE WHEN (UPPER(a.paymentMode) = 'INSURANCE'
                          OR (a.insuranceCompany IS NOT NULL AND a.insuranceCompany <> ''))
                     THEN true ELSE false END), a.surgical
    """)
    List<Object[]> ipCategoryMatrixInRange(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /**
     * Daily IP admission time-series over a range.
     * Returns rows [admissionDate, totalCount, freeCount, insuranceCount].
     * Optional department filter (null = all).
     */
    @Query("""
        SELECT a.admissionDate,
               COUNT(a),
               SUM(CASE WHEN a.free = true THEN 1 ELSE 0 END),
               SUM(CASE WHEN (UPPER(a.paymentMode) = 'INSURANCE'
                             OR (a.insuranceCompany IS NOT NULL AND a.insuranceCompany <> ''))
                        THEN 1 ELSE 0 END)
        FROM Admission a
        WHERE a.admissionDate BETWEEN :from AND :to
          AND (:department IS NULL OR a.department = :department)
        GROUP BY a.admissionDate
        ORDER BY a.admissionDate
    """)
    List<Object[]> ipDailySeries(@Param("from") LocalDate from,
                                 @Param("to") LocalDate to,
                                 @Param("department") String department);

    /** Total insurance admissions within a range with optional department filter. */
    @Query("""
        SELECT COUNT(a) FROM Admission a
        WHERE a.admissionDate BETWEEN :from AND :to
          AND (:department IS NULL OR a.department = :department)
          AND (UPPER(a.paymentMode) = 'INSURANCE'
               OR (a.insuranceCompany IS NOT NULL AND a.insuranceCompany <> ''))
    """)
    long countInsuranceInRangeDept(@Param("from") LocalDate from,
                                   @Param("to") LocalDate to,
                                   @Param("department") String department);

    /** Get current date from MySQL — avoids JVM timezone issues */
    @Query(value = "SELECT CURDATE()", nativeQuery = true)
    java.sql.Date getCurrentDbDate();
}
