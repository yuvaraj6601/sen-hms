package com.hms.masters.service;

import com.hms.exception.DuplicateResourceException;
import com.hms.exception.ResourceNotFoundException;
import com.hms.masters.dto.DepartmentRequest;
import com.hms.masters.dto.DepartmentResponse;
import com.hms.masters.entity.Department;
import com.hms.masters.enums.Status;
import com.hms.masters.repository.DepartmentRepository;
import com.hms.common.AuditLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class DepartmentService {

    private final DepartmentRepository repo;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<DepartmentResponse> getAll() {
        return repo.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<DepartmentResponse> getActive() {
        return repo.findByStatusOrderByName(Status.ACTIVE).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public DepartmentResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    public DepartmentResponse create(DepartmentRequest req) {
        log.info("[DEPT] create name='{}'", req.getName());
        if (repo.existsByNameIgnoreCase(req.getName()))
            throw new DuplicateResourceException("Department already exists: " + req.getName());
        if (repo.existsByShortNameIgnoreCase(req.getShortName()))
            throw new DuplicateResourceException("Short name already in use: " + req.getShortName());

        Department dept = Department.builder()
                .deptCode(generateCode())
                .name(req.getName())
                .shortName(req.getShortName().toUpperCase())
                .type(req.getType())
                .hasWards(req.isHasWards())
                .totalBeds(req.isHasWards() ? req.getTotalBeds() : null)
                .occupiedBeds(0)
                .floor(req.getFloor())
                .headName(req.getHeadName())
                .phone(req.getPhone())
                .status(req.getStatus())
                .build();
        DepartmentResponse dSaved = toResponse(repo.save(dept));
        auditLogService.log("Department", dSaved.getId(), "CREATE", currentUser(), "code=" + dSaved.getDeptCode() + " name=" + dSaved.getName());
        return dSaved;
    }

    public DepartmentResponse update(Long id, DepartmentRequest req) {
        log.info("[DEPT] update id={} name='{}'", id, req.getName());
        Department dept = findOrThrow(id);

        if (!dept.getName().equalsIgnoreCase(req.getName()) &&
                repo.existsByNameIgnoreCase(req.getName()))
            throw new DuplicateResourceException("Department name already in use: " + req.getName());

        dept.setName(req.getName());
        dept.setShortName(req.getShortName().toUpperCase());
        dept.setType(req.getType());
        dept.setHasWards(req.isHasWards());
        dept.setTotalBeds(req.isHasWards() ? req.getTotalBeds() : null);
        dept.setFloor(req.getFloor());
        dept.setHeadName(req.getHeadName());
        dept.setPhone(req.getPhone());
        dept.setStatus(req.getStatus());
        DepartmentResponse dSaved = toResponse(repo.save(dept));
        auditLogService.log("Department", dSaved.getId(), "CREATE", currentUser(), "code=" + dSaved.getDeptCode() + " name=" + dSaved.getName());
        return dSaved;
    }

    public DepartmentResponse toggleStatus(Long id) {
        log.info("[DEPT] toggleStatus id={}", id);
        Department dept = findOrThrow(id);
        Status deptNewStatus = dept.getStatus() == Status.ACTIVE ? Status.INACTIVE : Status.ACTIVE;
        dept.setStatus(deptNewStatus);
        DepartmentResponse dToggled = toResponse(repo.save(dept));
        auditLogService.log("Department", id, "TOGGLE_STATUS", currentUser(), "status=" + deptNewStatus);
        return dToggled;

    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private Department findOrThrow(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Department", id));
    }

    private String generateCode() {
        int next = (repo.findMaxDeptCodeSequence() == null ? 0 : repo.findMaxDeptCodeSequence()) + 1;
        return String.format("DEPT%03d", next);
    }

    private DepartmentResponse toResponse(Department d) {
        DepartmentResponse r = new DepartmentResponse();
        r.setId(d.getId());
        r.setDeptCode(d.getDeptCode());
        r.setName(d.getName());
        r.setShortName(d.getShortName());
        r.setType(d.getType());
        r.setHasWards(d.isHasWards());
        r.setTotalBeds(d.getTotalBeds());
        r.setOccupiedBeds(d.getOccupiedBeds());
        r.setFloor(d.getFloor());
        r.setHeadName(d.getHeadName());
        r.setPhone(d.getPhone());
        r.setStatus(d.getStatus());
        r.setCreatedBy(d.getCreatedBy());
        r.setCreatedAt(d.getCreatedAt());
        r.setUpdatedAt(d.getUpdatedAt());
        return r;
    }

    private String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return "system";
        }
        return auth.getPrincipal().toString();
    }
}