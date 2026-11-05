package com.hms.masters.service;

import com.hms.exception.ResourceNotFoundException;
import com.hms.masters.dto.InvestigationRequest;
import com.hms.masters.dto.InvestigationResponse;
import com.hms.masters.entity.Investigation;
import com.hms.masters.enums.Status;
import com.hms.masters.repository.InvestigationRepository;
import com.hms.common.AuditLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class InvestigationService {

    private final InvestigationRepository repo;
    private final AuditLogService auditLogService;

    // ── Queries ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<InvestigationResponse> search(String search, String category, Status status, Pageable pageable) {
        return repo.search(
                StringUtils.hasText(search) ? search : null,
                StringUtils.hasText(category) ? category : null,
                status, pageable
        ).map(this::toResponse);
    }

    /** Lab-specific search that also filters by sampleType. */
    @Transactional(readOnly = true)
    public Page<InvestigationResponse> searchLabMasters(
            String search, String category, String subcategory,
            String sampleType, Status status, Pageable pageable) {
        return repo.searchWithSample(
                StringUtils.hasText(search) ? search : null,
                StringUtils.hasText(category) ? category : null,
                StringUtils.hasText(subcategory) ? subcategory : null,
                StringUtils.hasText(sampleType) ? sampleType : null,
                status, pageable
        ).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public InvestigationResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    @Transactional(readOnly = true)
    public List<String> getDistinctUnits() {
        return repo.findDistinctUnits();
    }

    @Transactional(readOnly = true)
    public List<String> getDistinctSubcategories(String category) {
        return repo.findDistinctSubcategories(category);
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    public InvestigationResponse create(InvestigationRequest req) {
        log.info("[INVESTIGATION] create name='{}' category={} subcategory={}",
                req.getName(), req.getCategory(), req.getSubcategory());
        Investigation inv = Investigation.builder()
                .testCode(generateCode())
                // required
                .name(req.getName())
                .category(req.getCategory())
                .subcategory(req.getSubcategory())
                .price(req.getPrice())
                .status(req.getStatus())
                // sample & collection
                .sampleType(req.getSampleType())
                .container(req.getContainer())
                .sampleVolume(req.getSampleVolume())
                .fastingRequired(req.getFastingRequired())
                .patientInstructions(req.getPatientInstructions())
                // reporting
                .turnaroundTime(req.getTurnaroundTime())
                .resultType(req.getResultType())
                .resultOptions(req.getResultOptions())
                .normalRange(req.getNormalRange())
                .unit(req.getUnit())
                .criticalLow(req.getCriticalLow())
                .criticalHigh(req.getCriticalHigh())
                .parameters(req.getParameters())
                // advanced
                .testMethod(req.getTestMethod())
                .specialInstructions(req.getSpecialInstructions())
                .displayOrder(req.getDisplayOrder())
                .notes(req.getNotes())
                .build();
        InvestigationResponse saved = toResponse(repo.save(inv));
        auditLogService.log("Investigation", saved.getId(), "CREATE", currentUser(),
                "code=" + saved.getTestCode() + " name=" + saved.getName());
        return saved;
    }

    public InvestigationResponse update(Long id, InvestigationRequest req) {
        log.info("[INVESTIGATION] update id={}", id);
        Investigation inv = findOrThrow(id);
        // required
        inv.setName(req.getName());
        inv.setCategory(req.getCategory());
        inv.setSubcategory(req.getSubcategory());
        inv.setPrice(req.getPrice());
        inv.setStatus(req.getStatus());
        // sample & collection
        inv.setSampleType(req.getSampleType());
        inv.setContainer(req.getContainer());
        inv.setSampleVolume(req.getSampleVolume());
        inv.setFastingRequired(req.getFastingRequired());
        inv.setPatientInstructions(req.getPatientInstructions());
        // reporting
        inv.setTurnaroundTime(req.getTurnaroundTime());
        inv.setResultType(req.getResultType());
        inv.setResultOptions(req.getResultOptions());
        inv.setNormalRange(req.getNormalRange());
        inv.setUnit(req.getUnit());
        inv.setCriticalLow(req.getCriticalLow());
        inv.setCriticalHigh(req.getCriticalHigh());
        inv.setParameters(req.getParameters());
        // advanced
        inv.setTestMethod(req.getTestMethod());
        inv.setSpecialInstructions(req.getSpecialInstructions());
        inv.setDisplayOrder(req.getDisplayOrder());
        inv.setNotes(req.getNotes());

        InvestigationResponse saved = toResponse(repo.save(inv));
        auditLogService.log("Investigation", saved.getId(), "UPDATE", currentUser(),
                "code=" + saved.getTestCode() + " name=" + saved.getName());
        return saved;
    }

    public InvestigationResponse toggleStatus(Long id) {
        log.info("[INVESTIGATION] toggleStatus id={}", id);
        Investigation inv = findOrThrow(id);
        Status next = inv.getStatus() == Status.ACTIVE ? Status.INACTIVE : Status.ACTIVE;
        inv.setStatus(next);
        InvestigationResponse saved = toResponse(repo.save(inv));
        auditLogService.log("Investigation", id, "TOGGLE_STATUS", currentUser(), "status=" + next);
        return saved;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Investigation findOrThrow(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Investigation", id));
    }

    private String generateCode() {
        int seq = (repo.findMaxSequence() == null ? 0 : repo.findMaxSequence()) + 1;
        return String.format("LAB%03d", seq);
    }

    private InvestigationResponse toResponse(Investigation i) {
        InvestigationResponse r = new InvestigationResponse();
        // identity
        r.setId(i.getId());
        r.setTestCode(i.getTestCode());
        r.setName(i.getName());
        r.setCategory(i.getCategory());
        r.setSubcategory(i.getSubcategory());
        r.setPrice(i.getPrice());
        r.setStatus(i.getStatus());
        // sample & collection
        r.setSampleType(i.getSampleType());
        r.setContainer(i.getContainer());
        r.setSampleVolume(i.getSampleVolume());
        r.setFastingRequired(i.getFastingRequired());
        r.setPatientInstructions(i.getPatientInstructions());
        // reporting
        r.setTurnaroundTime(i.getTurnaroundTime());
        r.setResultType(i.getResultType());
        r.setResultOptions(i.getResultOptions());
        r.setNormalRange(i.getNormalRange());
        r.setUnit(i.getUnit());
        r.setCriticalLow(i.getCriticalLow());
        r.setCriticalHigh(i.getCriticalHigh());
        r.setParameters(i.getParameters());
        // advanced
        r.setTestMethod(i.getTestMethod());
        r.setSpecialInstructions(i.getSpecialInstructions());
        r.setDisplayOrder(i.getDisplayOrder());
        r.setNotes(i.getNotes());
        // audit
        r.setCreatedBy(i.getCreatedBy());
        r.setCreatedAt(i.getCreatedAt());
        r.setUpdatedAt(i.getUpdatedAt());
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
