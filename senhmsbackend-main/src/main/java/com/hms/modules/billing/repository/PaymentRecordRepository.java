package com.hms.modules.billing.repository;

import com.hms.modules.billing.entity.PaymentRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

/**
 * Payment records = actual received income (cash accounting basis).
 *
 * Financial reports count only payments whose parent bill is NOT cancelled.
 * Draft bills have no payment records, so they are naturally excluded.
 */
public interface PaymentRecordRepository extends JpaRepository<PaymentRecord, Long> {

    /**
     * Daily received-income series over a range.
     * Returns rows [payment date, amount, txnCount].
     * Category = parent bill's `towards` (OPD / IPD / Pharmacy / Lab); when a
     * category filter is supplied it is matched case-insensitively against it.
     */
    @Query("""
        SELECT p.date, COALESCE(SUM(p.amount), 0), COUNT(p)
        FROM PaymentRecord p
        WHERE p.date BETWEEN :from AND :to
          AND p.bill.status <> com.hms.modules.billing.enums.BillStatus.CANCELLED
          AND (:category IS NULL OR LOWER(COALESCE(p.bill.towards, '')) = LOWER(:category))
        GROUP BY p.date
        ORDER BY p.date
    """)
    List<Object[]> incomeDailySeries(@Param("from") LocalDate from,
                                     @Param("to") LocalDate to,
                                     @Param("category") String category);

    /**
     * Received-income breakdown by category (parent bill `towards`) over a range.
     * Returns rows [category, amount, txnCount] ordered by amount desc.
     */
    @Query("""
        SELECT COALESCE(p.bill.towards, 'Other'), COALESCE(SUM(p.amount), 0), COUNT(p)
        FROM PaymentRecord p
        WHERE p.date BETWEEN :from AND :to
          AND p.bill.status <> com.hms.modules.billing.enums.BillStatus.CANCELLED
          AND (:category IS NULL OR LOWER(COALESCE(p.bill.towards, '')) = LOWER(:category))
        GROUP BY COALESCE(p.bill.towards, 'Other')
        ORDER BY SUM(p.amount) DESC
    """)
    List<Object[]> incomeCategorySeries(@Param("from") LocalDate from,
                                        @Param("to") LocalDate to,
                                        @Param("category") String category);

    /** Distinct income categories (bill `towards`) present in a range — for the category filter. */
    @Query("""
        SELECT DISTINCT COALESCE(p.bill.towards, 'Other')
        FROM PaymentRecord p
        WHERE p.date BETWEEN :from AND :to
          AND p.bill.status <> com.hms.modules.billing.enums.BillStatus.CANCELLED
        ORDER BY COALESCE(p.bill.towards, 'Other')
    """)
    List<String> distinctIncomeCategories(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
