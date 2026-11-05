package com.hms.masters.dto;

import com.hms.masters.enums.DoctorStatus;
import com.hms.masters.enums.Gender;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class DoctorRequest {

    @NotBlank(message = "Name is required")
    @Size(max = 150)
    private String name;

    @Size(max = 50)
    private String registrationNo;

    private LocalDate dob;

    private Gender gender;

    @NotNull(message = "Department ID is required")
    private Long departmentId;

    @Size(max = 20)
    private String phone;

    @Email
    @Size(max = 100)
    private String email;

    @Min(0)
    private Integer experienceYears;

    @DecimalMin("0.0")
    private Double opdFee;

    private String opdStartTime;
    private String opdEndTime;

    @Min(5)
    private Integer avgConsultMins;

    private String bio;

    private DoctorStatus status = DoctorStatus.ACTIVE;

    private List<String> qualifications;
    private List<String> specializations;
    private List<String> opdDays;
    private List<String> illnessTags;
}
