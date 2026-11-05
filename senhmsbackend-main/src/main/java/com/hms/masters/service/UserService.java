package com.hms.masters.service;

import com.hms.common.AuditLogService;
import com.hms.exception.DuplicateResourceException;
import com.hms.exception.ResourceNotFoundException;
import com.hms.masters.dto.UserRequest;
import com.hms.masters.dto.UserResponse;
import com.hms.masters.entity.Department;
import com.hms.masters.entity.User;
import com.hms.masters.enums.Status;
import com.hms.masters.enums.UserRole;
import com.hms.masters.repository.DepartmentRepository;
import com.hms.masters.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class UserService {

    private final UserRepository userRepo;
    private final DepartmentRepository deptRepo;
    private final BCryptPasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public Page<UserResponse> search(String search, UserRole role, Status status, Pageable pageable) {
        log.debug("[USER] search query='{}' role={} status={}", search, role, status);
        return userRepo.search(
                StringUtils.hasText(search) ? search : null,
                role, status, pageable
        ).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public UserResponse getById(Long id) {
        log.debug("[USER] getById id={}", id);
        return toResponse(findOrThrow(id));
    }

    public UserResponse create(UserRequest req) {
        log.info("[USER] Creating user email={} role={}", req.getEmail(), req.getRole());
        if (userRepo.existsByEmailIgnoreCase(req.getEmail()))
            throw new DuplicateResourceException("Email already registered: " + req.getEmail());

        if (!StringUtils.hasText(req.getPassword()) || req.getPassword().length() < 6)
            throw new IllegalArgumentException("Password must be at least 6 characters");

        Department dept = req.getDepartmentId() != null
                ? deptRepo.findById(req.getDepartmentId())
                         .orElseThrow(() -> new ResourceNotFoundException("Department", req.getDepartmentId()))
                : null;

        User user = User.builder()
                .employeeId(generateEmployeeId(req.getRole()))
                .name(req.getName())
                .email(req.getEmail())
                .password(passwordEncoder.encode(req.getPassword()))
                .role(req.getRole())
                .department(dept)
                .phone(req.getPhone())
                .status(req.getStatus())
                .joinedDate(req.getJoinedDate())
                .build();

        User saved = userRepo.save(user);
        log.info("[USER] Created employeeId={} email={}", saved.getEmployeeId(), saved.getEmail());
        auditLogService.log("User", saved.getId(), "CREATE", currentUser(),
                "employeeId=" + saved.getEmployeeId() + " email=" + saved.getEmail()
                        + " role=" + saved.getRole());
        return toResponse(saved);
    }

    public UserResponse update(Long id, UserRequest req) {
        log.info("[USER] Updating id={} email={}", id, req.getEmail());
        User user = findOrThrow(id);

        if (!user.getEmail().equalsIgnoreCase(req.getEmail()) &&
                userRepo.existsByEmailIgnoreCase(req.getEmail()))
            throw new DuplicateResourceException("Email already in use: " + req.getEmail());

        Department dept = req.getDepartmentId() != null
                ? deptRepo.findById(req.getDepartmentId())
                         .orElseThrow(() -> new ResourceNotFoundException("Department", req.getDepartmentId()))
                : null;

        user.setName(req.getName());
        user.setEmail(req.getEmail());
        if (StringUtils.hasText(req.getPassword())) {
            user.setPassword(passwordEncoder.encode(req.getPassword()));
        }
        user.setRole(req.getRole());
        user.setDepartment(dept);
        user.setPhone(req.getPhone());
        user.setStatus(req.getStatus());
        user.setJoinedDate(req.getJoinedDate());

        User saved = userRepo.save(user);
        log.info("[USER] Updated id={} email={}", id, saved.getEmail());
        auditLogService.log("User", id, "UPDATE", currentUser(),
                "email=" + saved.getEmail() + " role=" + saved.getRole());
        return toResponse(saved);
    }

    public UserResponse toggleStatus(Long id) {
        User user = findOrThrow(id);
        Status newStatus = user.getStatus() == Status.ACTIVE ? Status.INACTIVE : Status.ACTIVE;
        user.setStatus(newStatus);
        User saved = userRepo.save(user);
        log.info("[USER] ToggleStatus id={} email={} status={}", id, saved.getEmail(), newStatus);
        auditLogService.log("User", id, "TOGGLE_STATUS", currentUser(),
                "email=" + saved.getEmail() + " status=" + newStatus);
        return toResponse(saved);
    }

    public void resetPassword(Long id, String newPassword) {
        log.info("[USER] resetPassword for id={}", id);
        if (!StringUtils.hasText(newPassword) || newPassword.length() < 6)
            throw new IllegalArgumentException("Password must be at least 6 characters");
        User user = findOrThrow(id);
        user.setPassword(passwordEncoder.encode(newPassword));
        userRepo.save(user);
        auditLogService.log("User", id, "RESET_PASSWORD", currentUser(),
                "email=" + user.getEmail());
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private String generateEmployeeId(UserRole role) {
        String prefix = switch (role) {
            case ADMIN -> "ADM";
            case DOCTOR -> "DOC";
            case RECEPTIONIST -> "RCP";
            case LAB_TECH -> "LAB";
            case INSURANCE_COORDINATOR -> "INS";
            case NURSE -> "NRS";
            case MANAGING_DIRECTOR -> "MGD";
            case LAB_INS_REC -> "LIR";
        };
        Integer maxSeq = userRepo.findMaxSeqForRole(role.name());
        int seq = (maxSeq == null ? 0 : maxSeq) + 1;
        return String.format("%s-%04d", prefix, seq);
    }

    private String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return "system";
        }
        return auth.getPrincipal().toString();
    }

    private User findOrThrow(Long id) {
        return userRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User", id));
    }

    private UserResponse toResponse(User u) {
        UserResponse r = new UserResponse();
        r.setId(u.getId());
        r.setEmployeeId(u.getEmployeeId());
        r.setName(u.getName());
        r.setEmail(u.getEmail());
        r.setRole(u.getRole());
        r.setDepartmentId(u.getDepartment() != null ? u.getDepartment().getId() : null);
        r.setDepartmentName(u.getDepartment() != null ? u.getDepartment().getName() : null);
        r.setPhone(u.getPhone());
        r.setStatus(u.getStatus());
        r.setJoinedDate(u.getJoinedDate());
        r.setCreatedBy(u.getCreatedBy());
        r.setCreatedAt(u.getCreatedAt());
        r.setUpdatedAt(u.getUpdatedAt());
        return r;
    }
}
