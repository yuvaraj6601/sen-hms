package com.hms.auth.dto;

import com.hms.masters.enums.UserRole;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class LoginResponse {
    private String token;
    private Long userId;
    private String name;
    private String email;
    private String employeeId;
    private UserRole role;
    private Long departmentId;
    private String departmentName;
    /** For Doctor role — their doctor master record ID (used for appointment filtering) */
    private Long doctorId;
}
