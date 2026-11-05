package com.hms.modules.expense.repository;

import com.hms.modules.expense.entity.Expense;
import com.hms.modules.expense.enums.ExpenseStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    boolean existsByExpenseNo(String expenseNo);

    @Query("SELECT COALESCE(MAX(CAST(SUBSTRING(e.expenseNo, 4) AS int)), 0) FROM Expense e")
    Integer findMaxSequence();

    @Query("""
        SELECT e FROM Expense e
        WHERE (:search IS NULL
               OR LOWER(e.expenseNo) LIKE LOWER(CONCAT('%',:search,'%'))
               OR LOWER(e.category) LIKE LOWER(CONCAT('%',:search,'%'))
               OR LOWER(e.towards) LIKE LOWER(CONCAT('%',:search,'%'))
               OR LOWER(e.description) LIKE LOWER(CONCAT('%',:search,'%')))
        AND (:category IS NULL OR LOWER(e.category) = LOWER(:category))
        AND (:status IS NULL OR e.status = :status)
        AND (:dateFrom IS NULL OR e.date >= :dateFrom)
        AND (:dateTo IS NULL OR e.date <= :dateTo)
    """)
    Page<Expense> search(@Param("search")   String search,
                         @Param("category") String category,
                         @Param("status")   ExpenseStatus status,
                         @Param("dateFrom") LocalDate dateFrom,
                         @Param("dateTo")   LocalDate dateTo,
                         Pageable pageable);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM Expense e WHERE e.status = :status")
    BigDecimal sumByStatus(@Param("status") ExpenseStatus status);

    @Query("SELECT COUNT(e) FROM Expense e WHERE e.status = :status")
    long countByStatus(@Param("status") ExpenseStatus status);

    /** Sum of expense amount within a date range (inclusive). */
    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM Expense e WHERE e.date BETWEEN :from AND :to")
    BigDecimal sumAmountInRange(@Param("from") LocalDate from, @Param("to") LocalDate to);

    // ── Financial report series (posted expenses = APPROVED or PAID) ────────────
    // PENDING and REJECTED expenses are excluded from financial reports.
    /**
     * Daily expense series over a range.
     * Returns rows [date, amount, txnCount].
     * Optional category filter (null = all).
     */
    @Query("""
        SELECT e.date, COALESCE(SUM(e.amount), 0), COUNT(e)
        FROM Expense e
        WHERE e.date BETWEEN :from AND :to
          AND e.status IN (com.hms.modules.expense.enums.ExpenseStatus.APPROVED,
                           com.hms.modules.expense.enums.ExpenseStatus.PAID)
          AND (:category IS NULL OR LOWER(e.category) = LOWER(:category))
        GROUP BY e.date
        ORDER BY e.date
    """)
    java.util.List<Object[]> expenseDailySeries(@Param("from") LocalDate from,
                                                @Param("to") LocalDate to,
                                                @Param("category") String category);

    /**
     * Expense breakdown by category over a range (posted expenses only).
     * Returns rows [category, amount, txnCount] ordered by amount desc.
     */
    @Query("""
        SELECT e.category, COALESCE(SUM(e.amount), 0), COUNT(e)
        FROM Expense e
        WHERE e.date BETWEEN :from AND :to
          AND e.status IN (com.hms.modules.expense.enums.ExpenseStatus.APPROVED,
                           com.hms.modules.expense.enums.ExpenseStatus.PAID)
          AND (:category IS NULL OR LOWER(e.category) = LOWER(:category))
        GROUP BY e.category
        ORDER BY SUM(e.amount) DESC
    """)
    java.util.List<Object[]> expenseCategorySeries(@Param("from") LocalDate from,
                                                   @Param("to") LocalDate to,
                                                   @Param("category") String category);
}
