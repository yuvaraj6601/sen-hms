package com.hms.modules.contact.entity;

import com.hms.common.BaseEntity;
import com.hms.modules.contact.enums.ContactType;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "contacts")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Contact extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ContactType type;

    @Column(nullable = false, length = 20)
    private String phone;

    @Column(length = 100)
    private String email;

    @Column(length = 200)
    private String organization;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(length = 100)
    private String area;

    @Column(length = 100)
    private String district;

    @Column(columnDefinition = "TEXT")
    private String notes;
}
