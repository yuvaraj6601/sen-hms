package com.hms.masters.service;

import com.hms.exception.DuplicateResourceException;
import com.hms.exception.ResourceNotFoundException;
import com.hms.masters.dto.BillingModalityRequest;
import com.hms.masters.dto.BillingModalityResponse;
import com.hms.masters.entity.BillingModality;
import com.hms.masters.enums.Status;
import com.hms.masters.repository.BillingModalityRepository;
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
public class BillingModalityService {

    private final BillingModalityRepository repo;
    private final AuditLogService auditLogService;
    @Transactional(readOnly = true)
    public List<BillingModalityResponse> getAll() {
        return repo.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<BillingModalityResponse> getActive() {
        return repo.findByStatus(Status.ACTIVE).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public BillingModalityResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    public BillingModalityResponse create(BillingModalityRequest req) {
        log.info("[MODALITY] create name='{}'", req.getName());
        if (repo.existsByNameIgnoreCase(req.getName()))
            throw new DuplicateResourceException("Billing modality already exists: " + req.getName());
        if (repo.existsByShortNameIgnoreCase(req.getShortName()))
            throw new DuplicateResourceException("Short name already in use: " + req.getShortName());

        BillingModality m = BillingModality.builder()
                .modalityCode(generateCode())
                .name(req.getName()).shortName(req.getShortName().toUpperCase())
                .description(req.getDescription()).status(req.getStatus())
                .build();
        BillingModalityResponse modSaved = toResponse(repo.save(m));
        auditLogService.log("BillingModality", modSaved.getId(), "CREATE", currentUser(), "code=" + modSaved.getModalityCode() + " name=" + modSaved.getName());
        return modSaved;
    }

    public BillingModalityResponse update(Long id, BillingModalityRequest req) {
        log.info("[MODALITY] update id={}", id);
        BillingModality m = findOrThrow(id);
        if (!m.getName().equalsIgnoreCase(req.getName()) && repo.existsByNameIgnoreCase(req.getName()))
            throw new DuplicateResourceException("Modality name already in use");
        m.setName(req.getName()); m.setShortName(req.getShortName().toUpperCase());
        m.setDescription(req.getDescription()); m.setStatus(req.getStatus());
        BillingModalityResponse modSaved = toResponse(repo.save(m));
        auditLogService.log("BillingModality", modSaved.getId(), "CREATE", currentUser(), "code=" + modSaved.getModalityCode() + " name=" + modSaved.getName());
        return modSaved;
    }

    public BillingModalityResponse toggleStatus(Long id) {
        log.info("[MODALITY] toggleStatus id={}", id);
        BillingModality m = findOrThrow(id);
        Status modStatus = m.getStatus() == Status.ACTIVE ? Status.INACTIVE : Status.ACTIVE;
        m.setStatus(modStatus);
        BillingModalityResponse modToggled = toResponse(repo.save(m));
        auditLogService.log("BillingModality", id, "TOGGLE_STATUS", currentUser(), "status=" + modStatus);
        return modToggled;
    }

    private BillingModality findOrThrow(Long id) {
        return repo.findById(id).orElseThrow(() -> new ResourceNotFoundException("BillingModality", id));
    }

    private String generateCode() {
        int seq = (repo.findMaxSequence() == null ? 0 : repo.findMaxSequence()) + 1;
        return String.format("MOD%03d", seq);
    }

    private BillingModalityResponse toResponse(BillingModality m) {
        BillingModalityResponse r = new BillingModalityResponse();
        r.setId(m.getId()); r.setModalityCode(m.getModalityCode());
        r.setName(m.getName()); r.setShortName(m.getShortName());
        r.setDescription(m.getDescription()); r.setStatus(m.getStatus());
        r.setCreatedBy(m.getCreatedBy()); r.setCreatedAt(m.getCreatedAt()); r.setUpdatedAt(m.getUpdatedAt());
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