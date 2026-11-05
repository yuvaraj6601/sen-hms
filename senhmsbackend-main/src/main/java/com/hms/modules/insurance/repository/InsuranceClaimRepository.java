package com.hms.modules.insurance.repository;

import com.hms.modules.insurance.entity.InsuranceClaim;
import com.hms.modules.insurance.enums.ClaimStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface InsuranceClaimRepository extends JpaRepository<InsuranceClaim, Long> {

    Optional<InsuranceClaim> findByClaimNo(String claimNo);

    Optional<InsuranceClaim> findByBillId(Long billId);

    /** One claim per admission — used by the auto-create-on-cumulative flow. */
    Optional<InsuranceClaim> findByAdmissionId(Long admissionId);

    List<InsuranceClaim> findByPatientIdOrderBySubmittedDateDesc(Long patientId);

    long countByStatus(ClaimStatus status);

    // ── Claim number generation ────────────────────────────────────────────────
    @Query("""
        SELECT COALESCE(MAX(CAST(SUBSTRING(c.claimNo, 16) AS int)), 0)
        FROM InsuranceClaim c
        WHERE c.claimNo LIKE CONCAT('CLM-', :datePrefix, '-%')
    """)
    Integer findMaxClaimSeqForDate(@Param("datePrefix") String datePrefix);

    // ── Paginated search ───────────────────────────────────────────────────────
    @Query("""
        SELECT c FROM InsuranceClaim c
        WHERE (:search IS NULL
               OR LOWER(c.patientName)      LIKE LOWER(CONCAT('%',:search,'%'))
               OR LOWER(c.uhid)             LIKE LOWER(CONCAT('%',:search,'%'))
               OR LOWER(c.claimNo)          LIKE LOWER(CONCAT('%',:search,'%'))
               OR LOWER(c.insuranceCompany) LIKE LOWER(CONCAT('%',:search,'%')))
        AND (:status  IS NULL OR c.status  = :status)
        AND (:company IS NULL OR LOWER(c.insuranceCompany) LIKE LOWER(CONCAT('%',:company,'%')))
        AND (:dateFrom IS NULL OR c.submittedDate >= :dateFrom)
        AND (:dateTo   IS NULL OR c.submittedDate <= :dateTo)
    """)
    Page<InsuranceClaim> search(@Param("search")   String search,
                                @Param("status")   ClaimStatus status,
                                @Param("company")  String company,
                                @Param("dateFrom") LocalDate dateFrom,
                                @Param("dateTo")   LocalDate dateTo,
                                Pageable pageable);

    /**
     * Monthly settled insurance amount grouped by month for a given year.
     * Returns [month (1-12), sum(settledAmount)].
     */
    @Query("""
        SELECT MONTH(c.settledDate), COALESCE(SUM(c.settledAmount), 0)
        FROM InsuranceClaim c
        WHERE YEAR(c.settledDate) = :year
          AND c.status = com.hms.modules.insurance.enums.ClaimStatus.SETTLED
          AND c.settledAmount IS NOT NULL
          AND c.settledDate IS NOT NULL
        GROUP BY MONTH(c.settledDate)
    """)
    List<Object[]> sumSettledAmountByMonth(@Param("year") int year);

    /** Sum of settled insurance amount within a date range (by settled date, inclusive). */
    @Query("""
        SELECT COALESCE(SUM(c.settledAmount), 0)
        FROM InsuranceClaim c
        WHERE c.settledDate BETWEEN :from AND :to
          AND c.status = com.hms.modules.insurance.enums.ClaimStatus.SETTLED
          AND c.settledAmount IS NOT NULL
    """)
    java.math.BigDecimal sumSettledAmountInRange(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
