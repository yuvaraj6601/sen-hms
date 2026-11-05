package com.hms.masters.dto;

import com.hms.masters.enums.DoctorStatus;
import com.hms.masters.enums.Gender;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class DoctorResponse {
    private Long id;
    private String name;
    private String registrationNo;
    private LocalDate dob;
    private Gender gender;
    private Long departmentId;
    private String departmentName;
    private String phone;
    private String email;
    private Integer experienceYears;
    private Double opdFee;
    private String opdStartTime;
    private String opdEndTime;
    private Integer avgConsultMins;
    private String bio;
    private DoctorStatus status;
    private List<String> qualifications;
    private List<String> specializations;
    private List<String> opdDays;
    private List<String> illnessTags;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
