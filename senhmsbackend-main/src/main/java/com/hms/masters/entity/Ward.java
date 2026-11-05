package com.hms.masters.entity;

import com.hms.common.BaseEntity;
import com.hms.masters.enums.Status;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "wards")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Ward extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ward_code", unique = true, nullable = false, length = 20)
    private String wardCode;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "ward_type", length = 50)
    private String wardType;           // General, Private, Semi-Private, ICU, NICU…

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id")
    private Department department;

    @Column(name = "total_beds", nullable = false)
    private int totalBeds;

    @Column(name = "occupied_beds", nullable = false)
    private int occupiedBeds = 0;

    @Column(name = "charge_per_day", columnDefinition = "DECIMAL(10,2)")
    private Double chargePerDay;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Status status = Status.ACTIVE;
}
