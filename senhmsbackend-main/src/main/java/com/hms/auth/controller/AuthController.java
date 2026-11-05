package com.hms.auth.controller;

import com.hms.auth.dto.LoginRequest;
import com.hms.auth.dto.LoginResponse;
import com.hms.auth.service.AuthService;
import com.hms.common.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    /**
     * Login with email + password.
     * Returns JWT token + user info (including doctorId for Doctor role).
     *
     * POST /api/auth/login
     * {
     *   "email": "admin@hms.com",
     *   "password": "Admin@123"
     * }
     *
     * Response includes:
     * - token: JWT Bearer token
     * - userId, name, email, employeeId, role
     * - departmentId, departmentName
     * - doctorId: only set for DOCTOR role — used to filter their own appointments
     */
    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(
            @Valid @RequestBody LoginRequest req) {
        // Auth failures are mapped by GlobalExceptionHandler:
        //   AuthenticationFailedException -> 401, AccountInactiveException -> 403
        return ResponseEntity.ok(ApiResponse.ok(authService.login(req)));
    }
}
