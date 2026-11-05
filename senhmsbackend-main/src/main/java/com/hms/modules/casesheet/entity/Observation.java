package com.hms.modules.casesheet.entity;

import com.hms.common.BaseEntity;
import com.hms.modules.casesheet.enums.ObservationType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "observations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Observation extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "patient_id", nullable = false)
    private Long patientId;

    @Column(nullable = false, length = 25)
    private String uhid;

    /** Optional — linked to an admission for IP patients */
    @Column(name = "admission_id")
    private Long admissionId;

    /** Optional — linked to an OP visit */
    @Column(name = "visit_id")
    private Long visitId;

    @Column(nullable = false)
    private LocalDate date;

    @Column(nullable = false, length = 10)
    private String time;

    @Column(name = "doctor_name", nullable = false, length = 150)
    private String doctorName;

    @Column(name = "doctor_id")
    private Long doctorId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ObservationType type = ObservationType.ROUND;

    @Column(name = "chief_complaint", nullable = false, columnDefinition = "TEXT")
    private String chiefComplaint;

    @Column(name = "clinical_findings", columnDefinition = "TEXT")
    private String clinicalFindings;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String diagnosis;

    @Column(columnDefinition = "TEXT")
    private String plan;

    @Column(columnDefinition = "TEXT")
    private String notes;
}
