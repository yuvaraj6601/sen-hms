package com.hms.modules.expense.service;

import com.hms.common.AuditLogService;
import com.hms.exception.ResourceNotFoundException;
import com.hms.modules.expense.dto.*;
import com.hms.modules.expense.entity.Expense;
import com.hms.modules.expense.enums.ExpenseStatus;
import com.hms.modules.expense.repository.ExpenseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class ExpenseService {

    private final ExpenseRepository repo;
    private final AuditLogService auditLogService;

    // ── Read ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<ExpenseResponse> search(String search, String category,
                                        ExpenseStatus status,
                                        LocalDate dateFrom, LocalDate dateTo,
                                        Pageable pageable) {
        log.debug("[EXPENSE] search query='{}' category={} status={}", search, category, status);
        return repo.search(
                StringUtils.hasText(search)   ? search   : null,
                StringUtils.hasText(category) ? category : null,
                status, dateFrom, dateTo, pageable
        ).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public ExpenseResponse getById(Long id) {
        log.debug("[EXPENSE] getById id={}", id);
        return toResponse(findOrThrow(id));
    }

    @Transactional(readOnly = true)
    public ExpenseSummaryResponse getSummary() {
        long total    = repo.count();
        long pending  = repo.countByStatus(ExpenseStatus.PENDING);
        long approved = repo.countByStatus(ExpenseStatus.APPROVED);
        long paid     = repo.countByStatus(ExpenseStatus.PAID);
        long rejected = repo.countByStatus(ExpenseStatus.REJECTED);

        BigDecimal totalAmt = repo.sumByStatus(ExpenseStatus.PENDING)
                .add(repo.sumByStatus(ExpenseStatus.APPROVED))
                .add(repo.sumByStatus(ExpenseStatus.PAID));
        BigDecimal paidAmt  = repo.sumByStatus(ExpenseStatus.PAID);

        return new ExpenseSummaryResponse(total, pending, approved, paid, rejected, totalAmt, paidAmt);
    }

    // ── Write ─────────────────────────────────────────────────────────────────

    public ExpenseResponse create(ExpenseRequest req) {
        log.info("[EXPENSE] Creating category='{}' towards='{}' amount={} preparedBy='{}'",
                req.getCategory(), req.getTowards(), req.getAmount(), req.getPreparedBy());

        // Only Admin and Managing Director expenses are auto-approved.
        // All other roles (Receptionist, Lab/Ins/Reception, etc.) submit as PENDING
        // and require Admin/MD approval.
        boolean isSuperUser = "ADMIN".equalsIgnoreCase(req.getSubmittedByRole())
                || "MANAGING_DIRECTOR".equalsIgnoreCase(req.getSubmittedByRole());

        Expense e = Expense.builder()
                .expenseNo(generateNo())
                .date(req.getDate())
                .category(req.getCategory())
                .towards(req.getTowards())
                .amount(req.getAmount())
                .paymentMode(req.getPaymentMode())
                .referenceNo(req.getReferenceNo())
                .description(req.getDescription())
                .preparedBy(req.getPreparedBy())
                .status(isSuperUser ? ExpenseStatus.APPROVED : ExpenseStatus.PENDING)
                .approvedBy(isSuperUser ? req.getPreparedBy() : null)
                .build();

        Expense saved = repo.save(e);
        log.info("[EXPENSE] Created expenseNo={} id={} status={}", saved.getExpenseNo(), saved.getId(), saved.getStatus());
        auditLogService.log("Expense", saved.getId(), "CREATE", currentUser(),
                "expenseNo=" + saved.getExpenseNo() + " amount=" + saved.getAmount()
                        + " category=" + saved.getCategory() + " status=" + saved.getStatus());
        return toResponse(saved);
    }

    public ExpenseResponse update(Long id, ExpenseRequest req) {
        log.info("[EXPENSE] Updating id={}", id);
        Expense e = findOrThrow(id);
        if (e.getStatus() != ExpenseStatus.PENDING)
            throw new IllegalStateException("Only PENDING expenses can be edited");

        e.setDate(req.getDate());
        e.setCategory(req.getCategory());
        e.setTowards(req.getTowards());
        e.setAmount(req.getAmount());
        e.setPaymentMode(req.getPaymentMode());
        e.setReferenceNo(req.getReferenceNo());
        e.setDescription(req.getDescription());
        e.setPreparedBy(req.getPreparedBy());

        Expense saved = repo.save(e);
        auditLogService.log("Expense", id, "UPDATE", currentUser(),
                "expenseNo=" + saved.getExpenseNo() + " amount=" + saved.getAmount());
        return toResponse(saved);
    }

    public ExpenseResponse updateStatus(Long id, ExpenseStatusRequest req) {
        log.info("[EXPENSE] updateStatus id={} newStatus={}", id, req.getStatus());

        // ── Role guard ────────────────────────────────────────────────────────
        // Only Admin and Managing Director can approve, reject, or mark as paid.
        // Other roles (Receptionist, Doctor, etc.) can only submit (create) expenses.
        boolean isAdminCaller = currentUserIsAdmin();
        if (!isAdminCaller
                && (req.getStatus() == ExpenseStatus.APPROVED
                    || req.getStatus() == ExpenseStatus.REJECTED
                    || req.getStatus() == ExpenseStatus.PAID)) {
            throw new com.hms.exception.ResourceNotFoundException(
                    "Access denied: only Admin or Managing Director can approve, reject, or mark expenses as paid.");
        }

        Expense e = findOrThrow(id);
        ExpenseStatus old = e.getStatus();
        e.setStatus(req.getStatus());

        if (req.getStatus() == ExpenseStatus.APPROVED || req.getStatus() == ExpenseStatus.PAID) {
            if (StringUtils.hasText(req.getApprovedBy()))
                e.setApprovedBy(req.getApprovedBy());
        }
        if (req.getStatus() == ExpenseStatus.REJECTED) {
            e.setRejectionReason(req.getRejectionReason());
        }

        Expense saved = repo.save(e);
        auditLogService.log("Expense", id, "STATUS_UPDATE", currentUser(),
                "expenseNo=" + saved.getExpenseNo() + " from=" + old + " to=" + req.getStatus());
        return toResponse(saved);
    }

    public void delete(Long id) {
        log.info("[EXPENSE] Deleting id={}", id);
        Expense e = findOrThrow(id);
        if (e.getStatus() != ExpenseStatus.PENDING)
            throw new IllegalStateException("Only PENDING expenses can be deleted");
        repo.delete(e);
        auditLogService.log("Expense", id, "DELETE", currentUser(),
                "expenseNo=" + e.getExpenseNo());
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return "system";
        }
        return auth.getPrincipal().toString();
    }

    /** Returns true when the current JWT caller is Admin or Managing Director. */
    private boolean currentUserIsAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return false;
        return auth.getAuthorities().stream()
                .map(a -> a.getAuthority())
                .anyMatch(a -> a.equals("ROLE_Admin") || a.equals("ROLE_Managing Director"));
    }

    private String generateNo() {
        int seq = (repo.findMaxSequence() == null ? 0 : repo.findMaxSequence()) + 1;
        return String.format("EXP%04d", seq);
    }

    private Expense findOrThrow(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Expense", id));
    }

    private ExpenseResponse toResponse(Expense e) {
        ExpenseResponse r = new ExpenseResponse();
        r.setId(e.getId());
        r.setExpenseNo(e.getExpenseNo());
        r.setDate(e.getDate());
        r.setCategory(e.getCategory());
        r.setTowards(e.getTowards());
        r.setAmount(e.getAmount());
        r.setPaymentMode(e.getPaymentMode());
        r.setReferenceNo(e.getReferenceNo());
        r.setDescription(e.getDescription());
        r.setPreparedBy(e.getPreparedBy());
        r.setApprovedBy(e.getApprovedBy());
        r.setStatus(e.getStatus());
        r.setRejectionReason(e.getRejectionReason());
        r.setCreatedBy(e.getCreatedBy());
        r.setCreatedAt(e.getCreatedAt());
        r.setUpdatedAt(e.getUpdatedAt());
        return r;
    }
}
