package com.hms.masters.entity;

import com.hms.common.BaseEntity;
import com.hms.masters.enums.DoctorStatus;
import com.hms.masters.enums.Gender;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "doctors")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Doctor extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(name = "registration_no", unique = true, length = 50)
    private String registrationNo;

    @Column(name = "dob")
    private LocalDate dob;

    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    private Gender gender;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id")
    private Department department;

    @Column(length = 20)
    private String phone;

    @Column(length = 100)
    private String email;

    @Column(name = "experience_years")
    private Integer experienceYears;

    @Column(name = "opd_fee", columnDefinition = "DECIMAL(10,2)")
    private Double opdFee;

    @Column(name = "opd_start_time", length = 10)
    private String opdStartTime;

    @Column(name = "opd_end_time", length = 10)
    private String opdEndTime;

    @Column(name = "avg_consult_mins")
    private Integer avgConsultMins;

    @Column(columnDefinition = "TEXT")
    private String bio;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private DoctorStatus status = DoctorStatus.ACTIVE;

    // --- Stored as comma-separated strings ---

    @Column(columnDefinition = "TEXT")
    private String qualifications;   // CSV: "MBBS,MD,DM Cardiology"

    @Column(columnDefinition = "TEXT")
    private String specializations;  // CSV: "Cardiologist,Interventional Cardiology"

    @Column(name = "opd_days", columnDefinition = "TEXT")
    private String opdDays;          // CSV: "Mon,Tue,Wed"

    @Column(name = "illness_tags", columnDefinition = "TEXT")
    private String illnessTags;      // CSV: "chest pain,palpitations,hypertension"
}
