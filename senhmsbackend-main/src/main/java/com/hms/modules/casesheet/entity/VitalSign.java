package com.hms.modules.casesheet.entity;

import com.hms.common.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "vital_signs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class VitalSign extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "patient_id", nullable = false)
    private Long patientId;

    @Column(nullable = false, length = 25)
    private String uhid;

    @Column(name = "admission_id")
    private Long admissionId;

    @Column(name = "visit_id")
    private Long visitId;

    @Column(name = "recorded_at", nullable = false)
    private LocalDateTime recordedAt;

    @Column(name = "recorded_by", nullable = false, length = 150)
    private String recordedBy;

    /** e.g. "120/80" */
    @Column(name = "blood_pressure", length = 20)
    private String bloodPressure;

    /** Beats per minute */
    private Integer pulse;

    /** Fahrenheit */
    private Double temperature;

    /** Percentage */
    private Double spo2;

    /** Breaths per minute */
    private Integer respiratoryRate;

    /** Kilograms */
    private Double weight;

    /** Centimetres */
    private Double height;

    /** Blood glucose (mg/dL) */
    @Column(name = "blood_glucose")
    private Double bloodGlucose;

    @Column(columnDefinition = "TEXT")
    private String notes;
}
