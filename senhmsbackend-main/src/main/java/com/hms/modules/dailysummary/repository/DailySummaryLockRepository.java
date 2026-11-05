package com.hms.modules.dailysummary.repository;

import com.hms.modules.dailysummary.entity.DailySummaryLock;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface DailySummaryLockRepository extends JpaRepository<DailySummaryLock, Long> {

    Optional<DailySummaryLock> findBySummaryDate(LocalDate summaryDate);

    List<DailySummaryLock> findAllByOrderBySummaryDateDesc();
}
