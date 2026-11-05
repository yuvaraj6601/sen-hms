package com.hms.masters.entity;

import com.hms.common.BaseEntity;
import com.hms.masters.enums.Status;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "billing_modalities")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BillingModality extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "modality_code", unique = true, nullable = false, length = 20)
    private String modalityCode;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "short_name", nullable = false, length = 20)
    private String shortName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Status status = Status.ACTIVE;
}
