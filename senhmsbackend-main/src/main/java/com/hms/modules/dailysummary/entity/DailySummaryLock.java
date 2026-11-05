package com.hms.modules.dailysummary.entity;

import com.hms.common.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "daily_summary_locks")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DailySummaryLock extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "summary_date", unique = true, nullable = false)
    private LocalDate summaryDate;

    /** DRAFT or SUBMITTED */
    @Column(nullable = false, length = 15)
    private String status = "DRAFT";

    @Column(name = "submitted_by", length = 100)
    private String submittedBy;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(columnDefinition = "TEXT")
    private String notes;
}
