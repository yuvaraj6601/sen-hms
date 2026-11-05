package com.hms.modules.casesheet.entity;

import com.hms.common.BaseEntity;
import com.hms.modules.casesheet.enums.MedicationRoute;
import com.hms.modules.casesheet.enums.MedicationStatus;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "medications")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Medication extends BaseEntity {

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

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false, length = 10)
    private String time;

    @Column(name = "prescribed_by", nullable = false, length = 150)
    private String prescribedBy;

    @Column(name = "prescribed_by_id")
    private Long prescribedById;

    @Column(name = "drug_name", nullable = false, length = 200)
    private String drugName;

    @Column(nullable = false, length = 100)
    private String dosage;

    @Column(nullable = false, length = 100)
    private String frequency;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MedicationRoute route = MedicationRoute.ORAL;

    @Column(length = 100)
    private String duration;

    @Column(columnDefinition = "TEXT")
    private String instructions;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private MedicationStatus status = MedicationStatus.ACTIVE;

    /** Set when status → STOPPED */
    @Column(name = "stopped_on")
    private LocalDate stoppedOn;

    @Column(name = "stopped_reason", columnDefinition = "TEXT")
    private String stoppedReason;

    @Column(name = "stopped_by", length = 150)
    private String stoppedBy;
}
