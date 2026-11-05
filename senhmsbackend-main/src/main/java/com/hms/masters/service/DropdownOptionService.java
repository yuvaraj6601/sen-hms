package com.hms.masters.service;

import com.hms.common.AuditLogService;
import com.hms.common.PagedResponse;
import com.hms.exception.DuplicateResourceException;
import com.hms.exception.ResourceNotFoundException;
import com.hms.masters.dto.DropdownOptionRequest;
import com.hms.masters.dto.DropdownOptionResponse;
import com.hms.masters.entity.DropdownOption;
import com.hms.masters.enums.DropdownCategory;
import com.hms.masters.enums.Status;
import com.hms.masters.repository.DropdownOptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class DropdownOptionService {

    private final DropdownOptionRepository repo;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public PagedResponse<DropdownOptionResponse> search(DropdownCategory category, String search,
                                                        Status status, Pageable pageable) {
        return new PagedResponse<>(
                repo.search(category, StringUtils.hasText(search) ? search : null, status, pageable)
                    .map(this::toResponse));
    }

    @Transactional(readOnly = true)
    public DropdownOptionResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    public DropdownOptionResponse create(DropdownOptionRequest req) {
        return create(req, false);
    }

    /**
     * @param idempotent when true, an existing option with the same (category,label)
     *                   is returned instead of throwing — used by inline "+ Add"
     *                   from forms so re-adding an existing value never errors.
     */
    public DropdownOptionResponse create(DropdownOptionRequest req, boolean idempotent) {
        String label = req.getLabel().trim();
        if (repo.existsByCategoryAndLabelIgnoreCase(req.getCategory(), label)) {
            if (idempotent) {
                return repo.findFirstByCategoryAndLabelIgnoreCase(req.getCategory(), label)
                           .map(this::toResponse)
                           .orElseThrow(() -> new DuplicateResourceException(
                                   "\"" + label + "\" already exists in " + req.getCategory()));
            }
            throw new DuplicateResourceException(
                    "\"" + label + "\" already exists in " + req.getCategory());
        }
        DropdownOption entity = DropdownOption.builder()
                .category(req.getCategory())
                .label(label)
                .displayOrder(req.getDisplayOrder())
                .status(req.getStatus() != null ? req.getStatus() : Status.ACTIVE)
                .build();
        DropdownOptionResponse saved = toResponse(repo.save(entity));
        auditLogService.log("DropdownOption", saved.getId(), "CREATE", currentUser(),
                "category=" + saved.getCategory() + " label=" + saved.getLabel());
        return saved;
    }

    public DropdownOptionResponse update(Long id, DropdownOptionRequest req) {
        DropdownOption entity = findOrThrow(id);
        String label = req.getLabel().trim();
        // Category is immutable on edit; keep the stored one and dup-check within it.
        if (repo.existsByCategoryAndLabelIgnoreCaseAndIdNot(entity.getCategory(), label, id)) {
            throw new DuplicateResourceException(
                    "\"" + label + "\" already exists in " + entity.getCategory());
        }
        entity.setLabel(label);
        entity.setDisplayOrder(req.getDisplayOrder());
        if (req.getStatus() != null) entity.setStatus(req.getStatus());
        DropdownOptionResponse saved = toResponse(repo.save(entity));
        auditLogService.log("DropdownOption", id, "UPDATE", currentUser(),
                "category=" + saved.getCategory() + " label=" + saved.getLabel());
        return saved;
    }

    public DropdownOptionResponse toggleStatus(Long id) {
        DropdownOption entity = findOrThrow(id);
        Status next = entity.getStatus() == Status.ACTIVE ? Status.INACTIVE : Status.ACTIVE;
        entity.setStatus(next);
        DropdownOptionResponse saved = toResponse(repo.save(entity));
        auditLogService.log("DropdownOption", id, "TOGGLE_STATUS", currentUser(), "status=" + next);
        return saved;
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private DropdownOption findOrThrow(Long id) {
        return repo.findById(id)
                   .orElseThrow(() -> new ResourceNotFoundException("DropdownOption", id));
    }

    private DropdownOptionResponse toResponse(DropdownOption e) {
        return DropdownOptionResponse.builder()
                .id(e.getId())
                .category(e.getCategory())
                .label(e.getLabel())
                .displayOrder(e.getDisplayOrder())
                .status(e.getStatus().name())
                .createdBy(e.getCreatedBy())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }

    private String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return "system";
        }
        return auth.getPrincipal().toString();
    }
}
