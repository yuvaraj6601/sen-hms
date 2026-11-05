package com.hms.modules.admission.entity;

import com.hms.common.BaseEntity;
import com.hms.modules.admission.enums.TransferType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "transfer_logs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TransferLog extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Auto-generated: TRF-YYYYMMDD-XXXX */
    @Column(name = "transfer_no", unique = true, nullable = false, length = 25)
    private String transferNo;

    @Column(name = "admission_id", nullable = false)
    private Long admissionId;

    @Column(name = "admission_no", nullable = false, length = 25)
    private String admissionNo;

    @Column(name = "patient_id", nullable = false)
    private Long patientId;

    @Column(nullable = false, length = 25)
    private String uhid;

    @Column(name = "patient_name", nullable = false, length = 150)
    private String patientName;

    @Enumerated(EnumType.STRING)
    @Column(name = "transfer_type", nullable = false, length = 20)
    private TransferType transferType;

    @Column(name = "from_value", nullable = false, length = 200)
    private String fromValue;

    @Column(name = "to_value", nullable = false, length = 200)
    private String toValue;

    /** IDs for ward/bed/doctor/department transfers — used to update the admission record */
    @Column(name = "to_id")
    private Long toId;

    @Column(name = "transfer_date", nullable = false)
    private LocalDate transferDate;

    @Column(name = "transfer_time", length = 10)
    private String transferTime;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String reason;

    @Column(name = "ordered_by", length = 150)
    private String orderedBy;     // Doctor name

    @Column(name = "done_by", length = 150)
    private String doneBy;        // Nurse / Admin name

    @Column(columnDefinition = "TEXT")
    private String notes;
}
