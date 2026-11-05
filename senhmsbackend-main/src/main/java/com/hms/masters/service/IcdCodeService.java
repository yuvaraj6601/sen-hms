package com.hms.masters.service;

import com.hms.masters.dto.IcdCodeRequest;
import com.hms.masters.dto.IcdCodeResponse;
import com.hms.masters.entity.IcdCode;
import com.hms.masters.enums.IcdCodeType;
import com.hms.masters.enums.Status;
import com.hms.masters.repository.IcdCodeRepository;
import com.hms.common.PagedResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class IcdCodeService {

    private final IcdCodeRepository repo;

    @Transactional(readOnly = true)
    public PagedResponse<IcdCodeResponse> search(String search, IcdCodeType codeType,
                                                  Status status, Pageable pageable) {
        return new PagedResponse<>(
                repo.search(search, codeType, status, pageable)
                    .map(this::toResponse));
    }

    @Transactional(readOnly = true)
    public IcdCodeResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    @Transactional(readOnly = true)
    public List<IcdCodeResponse> autocomplete(String q, IcdCodeType codeType) {
        Pageable top20 = PageRequest.of(0, 20, Sort.by("icdCode"));
        return repo.autocomplete(q, codeType, top20)
                   .stream().map(this::toResponse).toList();
    }

    @Transactional
    public IcdCodeResponse create(IcdCodeRequest req) {
        IcdCode entity = IcdCode.builder()
                .complaint(req.getComplaint().trim())
                .icdCode(req.getIcdCode().trim().toUpperCase())
                .description(req.getDescription().trim())
                .codeType(req.getCodeType())
                .status(Status.ACTIVE)
                .build();
        return toResponse(repo.save(entity));
    }

    @Transactional
    public IcdCodeResponse update(Long id, IcdCodeRequest req) {
        IcdCode entity = findOrThrow(id);
        entity.setComplaint(req.getComplaint().trim());
        entity.setIcdCode(req.getIcdCode().trim().toUpperCase());
        entity.setDescription(req.getDescription().trim());
        entity.setCodeType(req.getCodeType());
        return toResponse(repo.save(entity));
    }

    @Transactional
    public IcdCodeResponse toggleStatus(Long id) {
        IcdCode entity = findOrThrow(id);
        entity.setStatus(entity.getStatus() == Status.ACTIVE ? Status.INACTIVE : Status.ACTIVE);
        return toResponse(repo.save(entity));
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private IcdCode findOrThrow(Long id) {
        return repo.findById(id)
                   .orElseThrow(() -> new IllegalArgumentException("ICD code not found: " + id));
    }

    private IcdCodeResponse toResponse(IcdCode e) {
        return IcdCodeResponse.builder()
                .id(e.getId())
                .complaint(e.getComplaint())
                .icdCode(e.getIcdCode())
                .description(e.getDescription())
                .codeType(e.getCodeType())
                .status(e.getStatus().name())
                .createdBy(e.getCreatedBy())
                .createdAt(e.getCreatedAt())
                .updatedAt(e.getUpdatedAt())
                .build();
    }
}
