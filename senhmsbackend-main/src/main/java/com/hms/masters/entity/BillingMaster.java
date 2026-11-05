package com.hms.masters.entity;

import com.hms.common.BaseEntity;
import com.hms.masters.enums.Status;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;

@Entity
@Table(name = "billing_masters")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class BillingMaster extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "service_code", unique = true, nullable = false, length = 20)
    private String serviceCode;

    @Column(name = "service_name", nullable = false, length = 150)
    private String serviceName;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "modality_id", nullable = false)
    private BillingModality modality;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @Column(name = "discount_allowed", nullable = false)
    private boolean discountAllowed = false;

    /** Whether this service appears in the OP bill's service dropdown. */
    @Column(name = "show_in_op", nullable = false)
    private boolean showInOp = true;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Status status = Status.ACTIVE;
}
