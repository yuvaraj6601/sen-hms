package com.hms.masters.entity;

import com.hms.common.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "beds")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Bed extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    private String number;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ward_id", nullable = false)
    private Ward ward;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private BedStatus status = BedStatus.AVAILABLE;

    @Column(name = "patient_id")
    private Long patientId;

    @Column(name = "patient_name", length = 150)
    private String patientName;

    public enum BedStatus {
        AVAILABLE, OCCUPIED, RESERVED, MAINTENANCE
    }
}
