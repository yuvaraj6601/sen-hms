package com.hms.masters.entity;

import com.hms.common.BaseEntity;
import com.hms.masters.enums.ReferrerType;
import com.hms.masters.enums.Status;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "referrers")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Referrer extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReferrerType type;

    @Column(length = 100)
    private String specialization;

    @Column(length = 150)
    private String organization;

    @Column(length = 20)
    private String phone;

    @Column(name = "alternate_phone", length = 20)
    private String alternatePhone;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Status status = Status.ACTIVE;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "total_referrals")
    private Integer totalReferrals = 0;
}
