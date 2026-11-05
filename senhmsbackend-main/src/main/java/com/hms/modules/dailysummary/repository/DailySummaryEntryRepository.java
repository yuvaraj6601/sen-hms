package com.hms.modules.dailysummary.repository;

import com.hms.modules.dailysummary.entity.DailySummaryEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface DailySummaryEntryRepository extends JpaRepository<DailySummaryEntry, Long> {

    List<DailySummaryEntry> findByEntryDateOrderBySnoAsc(LocalDate entryDate);

    int countByEntryDate(LocalDate entryDate);

    /**
     * Monthly manual cash collection grouped by month for a given year.
     * Returns [month (1-12), sum(amount)].
     */
    @Query("""
        SELECT MONTH(e.entryDate), COALESCE(SUM(e.amount), 0)
        FROM DailySummaryEntry e
        WHERE YEAR(e.entryDate) = :year
        GROUP BY MONTH(e.entryDate)
    """)
    List<Object[]> sumAmountByMonth(@Param("year") int year);

    /** Sum of manual collection entries within a date range (inclusive). */
    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM DailySummaryEntry e WHERE e.entryDate BETWEEN :from AND :to")
    BigDecimal sumAmountInRange(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
