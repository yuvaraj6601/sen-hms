package com.hms.modules.dailysummary.entity;

import com.hms.common.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "daily_summary_entries")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DailySummaryEntry extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "entry_date", nullable = false)
    private LocalDate entryDate;

    @Column(nullable = false)
    private Integer sno;

    @Column(name = "patient_name", nullable = false, length = 150)
    private String patientName;

    private Integer age;

    @Column(length = 5)
    private String sex;

    @Column(name = "visit_type", length = 10)
    private String visitType;   // OP / IP / ICU / HDU

    @Column(name = "consultant_name", nullable = false, length = 150)
    private String consultantName;

    @Column(nullable = false, length = 300)
    private String diagnosis;

    @Column(name = "payment_mode", nullable = false, length = 15)
    private String paymentMode;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount = BigDecimal.ZERO;

    /** JSON: [{mode:"Cash",amount:500},{mode:"UPI",amount:300}] */
    @Column(name = "payment_splits_json", columnDefinition = "TEXT")
    private String paymentSplitsJson;

    @Column(columnDefinition = "TEXT")
    private String notes;
}
