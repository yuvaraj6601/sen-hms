package com.hms.auth.service;

import com.hms.auth.dto.LoginRequest;
import com.hms.auth.dto.LoginResponse;
import com.hms.auth.util.JwtUtil;
import com.hms.common.AuditLogService;
import com.hms.exception.AccountInactiveException;
import com.hms.exception.AuthenticationFailedException;
import com.hms.masters.entity.Doctor;
import com.hms.masters.entity.User;
import com.hms.masters.enums.Status;
import com.hms.masters.enums.UserRole;
import com.hms.masters.repository.DoctorRepository;
import com.hms.masters.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuthService {

    private final UserRepository userRepo;
    private final DoctorRepository doctorRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuditLogService auditLogService;

    public LoginResponse login(LoginRequest req) {
        log.info("[AUTH] Login attempt for email={}", req.getEmail());

        User user = userRepo.findByEmailIgnoreCase(req.getEmail())
                .orElseThrow(() -> {
                    log.warn("[AUTH] Login failed – email not found: {}", req.getEmail());
                    return new AuthenticationFailedException("Invalid email or password");
                });

        if (user.getStatus() != Status.ACTIVE) {
            log.warn("[AUTH] Login rejected – account inactive: email={}", req.getEmail());
            throw new AccountInactiveException("Account is inactive. Contact admin.");
        }

        if (!passwordEncoder.matches(req.getPassword(), user.getPassword())) {
            log.warn("[AUTH] Login failed – wrong password: email={}", req.getEmail());
            throw new AuthenticationFailedException("Invalid email or password");
        }

        String token = jwtUtil.generateToken(user.getId(), user.getEmail(), user.getRole().name());

        Long doctorId = null;
        if (user.getRole() == UserRole.DOCTOR) {
            List<Doctor> doctors = doctorRepo.searchDoctors(
                    user.getName(), null, null, PageRequest.of(0, 1)
            ).getContent();
            if (!doctors.isEmpty()) {
                doctorId = doctors.get(0).getId();
            }
        }

        log.info("[AUTH] Login successful: email={} role={}", user.getEmail(), user.getRole());
        auditLogService.log("User", user.getId(), "LOGIN", user.getEmail(), "role=" + user.getRole());

        return new LoginResponse(
                token,
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getEmployeeId(),
                user.getRole(),
                user.getDepartment() != null ? user.getDepartment().getId() : null,
                user.getDepartment() != null ? user.getDepartment().getName() : null,
                doctorId
        );
    }
}
