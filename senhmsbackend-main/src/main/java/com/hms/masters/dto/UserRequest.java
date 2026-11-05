package com.hms.masters.dto;

import com.hms.masters.enums.Status;
import com.hms.masters.enums.UserRole;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDate;

@Data
public class UserRequest {

    @NotBlank(message = "Name is required")
    @Size(max = 150)
    private String name;

    @NotBlank(message = "Email is required")
    @Email
    @Size(max = 100)
    private String email;

    @Size(min = 6, message = "Password must be at least 6 characters")
    private String password;

    @NotNull(message = "Role is required")
    private UserRole role;

    private Long departmentId;

    @Size(max = 20)
    private String phone;

    private Status status = Status.ACTIVE;

    private LocalDate joinedDate;
}
