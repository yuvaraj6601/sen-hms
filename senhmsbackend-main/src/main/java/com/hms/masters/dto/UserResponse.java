package com.hms.masters.dto;

import com.hms.masters.enums.Status;
import com.hms.masters.enums.UserRole;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class UserResponse {
    private Long id;
    private String employeeId;
    private String name;
    private String email;
    private UserRole role;
    private Long departmentId;
    private String departmentName;
    private String phone;
    private Status status;
    private LocalDate joinedDate;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
