package com.hms.masters.entity;

import com.hms.common.BaseEntity;
import com.hms.masters.enums.DepartmentType;
import com.hms.masters.enums.Status;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "departments")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Department extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "dept_code", unique = true, nullable = false, length = 20)
    private String deptCode;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "short_name", nullable = false, length = 20)
    private String shortName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DepartmentType type;

    @Column(name = "has_wards", nullable = false)
    private boolean hasWards = false;

    @Column(name = "total_beds")
    private Integer totalBeds;

    @Column(name = "occupied_beds")
    private Integer occupiedBeds = 0;

    @Column(length = 50)
    private String floor;

    @Column(name = "head_name", length = 100)
    private String headName;

    @Column(length = 20)
    private String phone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Status status = Status.ACTIVE;
}
