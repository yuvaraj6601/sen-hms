package com.hms.modules.prescription.entity;

import com.hms.common.BaseEntity;
import com.hms.modules.prescription.enums.PrescriptionSource;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** Maps the EXISTING {@code prescriptions} table — no schema changes. */
@Entity
@Table(name = "prescriptions")
@Getter @Setter @NoArgsConstructor
public class Prescription extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "prescription_no", nullable = false, unique = true, length = 25)
    private String prescriptionNo;

    @Column(name = "patient_id", nullable = false, length = 50)
    private String patientId;

    @Column(nullable = false, length = 25)
    private String uhid;

    @Column(name = "patient_name", nullable = false, length = 150)
    private String patientName;

    private Integer age;

    @Column(length = 10)
    private String gender;

    @Column(length = 100)
    private String department;

    @Column(name = "admission_id")
    private Long admissionId;

    @Column(name = "visit_id")
    private Long visitId;

    @Column(name = "doctor_id", length = 50)
    private String doctorId;

    @Column(name = "doctor_name", nullable = false, length = 150)
    private String doctorName;

    @Column(name = "visit_date", nullable = false)
    private LocalDate visitDate;

    @Column(columnDefinition = "TEXT")
    private String diagnosis;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(length = 15)
    private PrescriptionSource source;

    @Column(name = "voice_transcript", columnDefinition = "TEXT")
    private String voiceTranscript;

    @OneToMany(mappedBy = "prescription", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<PrescriptionItem> items = new ArrayList<>();
}
