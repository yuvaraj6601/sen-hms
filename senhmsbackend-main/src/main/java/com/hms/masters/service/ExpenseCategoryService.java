package com.hms.masters.service;

import com.hms.exception.DuplicateResourceException;
import com.hms.exception.ResourceNotFoundException;
import com.hms.masters.dto.ExpenseCategoryRequest;
import com.hms.masters.dto.ExpenseCategoryResponse;
import com.hms.masters.entity.ExpenseCategory;
import com.hms.masters.enums.Status;
import com.hms.masters.repository.ExpenseCategoryRepository;
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
public class ExpenseCategoryService {

    private final ExpenseCategoryRepository repo;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public List<ExpenseCategoryResponse> getAll() {
        return repo.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public ExpenseCategoryResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    public ExpenseCategoryResponse create(ExpenseCategoryRequest req) {
        log.info("[EXPENSE_CAT] create name='{}'", req.getName());
        if (repo.existsByNameIgnoreCase(req.getName()))
            throw new DuplicateResourceException("Expense category already exists: " + req.getName());
        ExpenseCategory ec = ExpenseCategory.builder()
                .categoryCode(generateCode()).name(req.getName())
                .description(req.getDescription()).status(req.getStatus())
                .build();
        ExpenseCategoryResponse ecSaved = toResponse(repo.save(ec));
        auditLogService.log("ExpenseCategory", ecSaved.getId(), "CREATE", currentUser(), "code=" + ecSaved.getCategoryCode() + " name=" + ecSaved.getName());
        return ecSaved;
    }

    public ExpenseCategoryResponse update(Long id, ExpenseCategoryRequest req) {
        log.info("[EXPENSE_CAT] update id={}", id);
        ExpenseCategory ec = findOrThrow(id);
        if (!ec.getName().equalsIgnoreCase(req.getName()) && repo.existsByNameIgnoreCase(req.getName()))
            throw new DuplicateResourceException("Category name already in use");
        ec.setName(req.getName()); ec.setDescription(req.getDescription()); ec.setStatus(req.getStatus());
        ExpenseCategoryResponse ecSaved = toResponse(repo.save(ec));
        auditLogService.log("ExpenseCategory", ecSaved.getId(), "CREATE", currentUser(), "code=" + ecSaved.getCategoryCode() + " name=" + ecSaved.getName());
        return ecSaved;
    }

    public ExpenseCategoryResponse toggleStatus(Long id) {
        log.info("[EXPENSE_CAT] toggleStatus id={}", id);
        ExpenseCategory ec = findOrThrow(id);
        Status ecStatus = ec.getStatus() == Status.ACTIVE ? Status.INACTIVE : Status.ACTIVE;
        ec.setStatus(ecStatus);
        ExpenseCategoryResponse ecToggled = toResponse(repo.save(ec));
        auditLogService.log("ExpenseCategory", id, "TOGGLE_STATUS", currentUser(), "status=" + ecStatus);
        return ecToggled;

    }

    private ExpenseCategory findOrThrow(Long id) {
        return repo.findById(id).orElseThrow(() -> new ResourceNotFoundException("ExpenseCategory", id));
    }

    private String generateCode() {
        int seq = (repo.findMaxSequence() == null ? 0 : repo.findMaxSequence()) + 1;
        return String.format("EXC%03d", seq);
    }

    private ExpenseCategoryResponse toResponse(ExpenseCategory e) {
        ExpenseCategoryResponse r = new ExpenseCategoryResponse();
        r.setId(e.getId()); r.setCategoryCode(e.getCategoryCode());
        r.setName(e.getName()); r.setDescription(e.getDescription()); r.setStatus(e.getStatus());
        r.setCreatedBy(e.getCreatedBy()); r.setCreatedAt(e.getCreatedAt()); r.setUpdatedAt(e.getUpdatedAt());
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