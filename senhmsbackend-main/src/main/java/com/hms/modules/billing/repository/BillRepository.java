package com.hms.modules.billing.repository;

import com.hms.modules.billing.entity.Bill;
import com.hms.modules.billing.enums.BillStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface BillRepository extends JpaRepository<Bill, Long> {

    Optional<Bill> findByBillNo(String billNo);

    List<Bill> findByPatientIdOrderByDateDesc(Long patientId);

    List<Bill> findByAdmissionIdOrderByDateDesc(Long admissionId);

    /**
     * Returns open (PENDING or PARTIAL) IPD bills for an admission.
     * Used to block a second IPD bill being raised while one is already outstanding.
     * Lab/Pharmacy/other towards types are intentionally excluded — those can have
     * multiple bills per admission (each test visit gets its own bill).
     */
    @Query("""
        SELECT b FROM Bill b
        WHERE b.admissionId = :admissionId
          AND LOWER(b.towards) = 'ipd'
          AND b.status IN (
              com.hms.modules.billing.enums.BillStatus.PENDING,
              com.hms.modules.billing.enums.BillStatus.PARTIAL
          )
        ORDER BY b.date DESC
    """)
    List<Bill> findOpenIPDBillsForAdmission(@Param("admissionId") Long admissionId);

    /**
     * All OPEN, real (non-consolidated) bills for an admission — DRAFT, PENDING or
     * PARTIAL, any {@code towards}. Enforces "one bill per admission": the Collect
     * Cash flow creates a DRAFT to hold receipts, so a second manual bill must be
     * blocked even while the first is still a DRAFT (which the IPD-only query above
     * misses). Consolidated/Summary view-only docs and CANCELLED/PAID bills are
     * excluded — a closed admission bill does not block a correction.
     */
    @Query("""
        SELECT b FROM Bill b
        WHERE b.admissionId = :admissionId
          AND b.consolidated = false
          AND b.status IN (
              com.hms.modules.billing.enums.BillStatus.DRAFT,
              com.hms.modules.billing.enums.BillStatus.PENDING,
              com.hms.modules.billing.enums.BillStatus.PARTIAL
          )
        ORDER BY b.date DESC
    """)
    List<Bill> findOpenBillsForAdmission(@Param("admissionId") Long admissionId);

    // ── Bill number generation ─────────────────────────────────────────────────
    @Query("""
        SELECT COALESCE(MAX(CAST(SUBSTRING(b.billNo, 16) AS int)), 0)
        FROM Bill b
        WHERE b.billNo LIKE CONCAT('BILL-', :datePrefix, '-%')
    """)
    Integer findMaxBillSeqForDate(@Param("datePrefix") String datePrefix);

    /** Highest sequence used for receipt numbers (RCPT-yyyyMMdd-XXXX) on a date. */
    @Query("""
        SELECT COALESCE(MAX(CAST(SUBSTRING(p.receiptNo, 15) AS int)), 0)
        FROM PaymentRecord p
        WHERE p.receiptNo LIKE CONCAT('RCPT-', :datePrefix, '-%')
    """)
    int findMaxReceiptSeqForDate(@Param("datePrefix") String datePrefix);

    // ── Paginated search ───────────────────────────────────────────────────────
    @Query("""
        SELECT b FROM Bill b
        WHERE (:search IS NULL
               OR LOWER(b.patientName) LIKE LOWER(CONCAT('%',:search,'%'))
               OR LOWER(b.uhid)        LIKE LOWER(CONCAT('%',:search,'%'))
               OR LOWER(b.billNo)      LIKE LOWER(CONCAT('%',:search,'%')))
        AND (:status      IS NULL OR b.status      = :status)
        AND (:patientType IS NULL OR b.patientType = :patientType)
        AND (:insurance   IS NULL OR b.insurance   = :insurance)
        AND (:dateFrom    IS NULL OR b.date >= :dateFrom)
        AND (:dateTo      IS NULL OR b.date <= :dateTo)
    """)
    Page<Bill> search(@Param("search")      String search,
                      @Param("status")      BillStatus status,
                      @Param("patientType") String patientType,
                      @Param("insurance")   Boolean insurance,
                      @Param("dateFrom")    LocalDate dateFrom,
                      @Param("dateTo")      LocalDate dateTo,
                      Pageable pageable);

    // ── Revenue summary ────────────────────────────────────────────────────────
    // NOTE: CONSOLIDATED-status rows are view-only consolidated/summary documents.
    // Their money already lives in the individual source bills, so every revenue
    // query below excludes them (status <> CANCELLED AND <> CONSOLIDATED) to avoid
    // double-counting.
    @Query("SELECT COALESCE(SUM(b.totalAmount), 0) FROM Bill b WHERE b.date = :date AND b.status NOT IN ('CANCELLED','CONSOLIDATED')")
    BigDecimal sumTotalAmountByDate(@Param("date") LocalDate date);

    @Query("SELECT COALESCE(SUM(b.paidAmount), 0) FROM Bill b WHERE b.date = :date AND b.status NOT IN ('CANCELLED','CONSOLIDATED')")
    BigDecimal sumPaidAmountByDate(@Param("date") LocalDate date);

    @Query("SELECT COALESCE(SUM(b.dueAmount), 0) FROM Bill b WHERE b.status IN ('PENDING','PARTIAL')")
    BigDecimal sumTotalDue();

    /** Sum of paid amount within a date range (inclusive), excluding cancelled + view-only consolidated/summary bills. */
    @Query("SELECT COALESCE(SUM(b.paidAmount), 0) FROM Bill b WHERE b.date BETWEEN :from AND :to AND b.status NOT IN (com.hms.modules.billing.enums.BillStatus.CANCELLED, com.hms.modules.billing.enums.BillStatus.CONSOLIDATED)")
    BigDecimal sumPaidAmountInRange(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /**
     * Monthly bill paid-amount grouped by month for a given year.
     * Returns [month (1-12), sum(paidAmount)].
     */
    @Query("""
        SELECT MONTH(b.date), COALESCE(SUM(b.paidAmount), 0)
        FROM Bill b
        WHERE YEAR(b.date) = :year
          AND b.status NOT IN (
              com.hms.modules.billing.enums.BillStatus.CANCELLED,
              com.hms.modules.billing.enums.BillStatus.CONSOLIDATED
          )
        GROUP BY MONTH(b.date)
    """)
    List<Object[]> sumPaidAmountByMonth(@Param("year") int year);

    long countByStatus(BillStatus status);

    /**
     * Distinct patient IDs that have at least one non-cancelled bill.
     * Used by the patient list to show "View Bill" instead of "Generate Bill"
     * when a bill already exists for the patient.
     */
    @Query("""
        SELECT DISTINCT b.patientId FROM Bill b
        WHERE b.patientId IS NOT NULL
          AND b.status <> com.hms.modules.billing.enums.BillStatus.CANCELLED
    """)
    List<Long> findDistinctPatientIdsWithActiveBills();
}
