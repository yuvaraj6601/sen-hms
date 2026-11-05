package com.hms.modules.pharmacy.service;

import com.hms.common.AuditLogService;
import com.hms.exception.ResourceNotFoundException;
import com.hms.modules.pharmacy.dto.*;
import com.hms.modules.pharmacy.entity.PharmacyEntry;
import com.hms.modules.pharmacy.entity.PharmacyPayment;
import com.hms.modules.pharmacy.entity.PharmacyReturn;
import com.hms.modules.pharmacy.enums.PharmacyPaymentMode;
import com.hms.modules.pharmacy.repository.PharmacyEntryRepository;
import com.hms.modules.pharmacy.repository.PharmacyPaymentRepository;
import com.hms.modules.pharmacy.repository.PharmacyReturnRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class PharmacyEntryService {

    private final PharmacyEntryRepository entryRepo;
    private final PharmacyReturnRepository returnRepo;
    private final PharmacyPaymentRepository paymentRepo;
    private final AuditLogService auditLogService;

    // ── Daily list ─────────────────────────────────────────────────────────────

    /**
     * Returns accounts relevant to the given day: accounts opened that day, plus
     * any account (opened earlier) that had a payment or a return on that day.
     * Each response carries collectedOnDate / returnedOnDate for that specific day.
     */
    @Transactional(readOnly = true)
    public List<PharmacyEntryResponse> listByDate(LocalDate date) {
        Set<Long> ids = new LinkedHashSet<>();

        entryRepo.findByEntryDateOrderBySnoAsc(date).forEach(e -> ids.add(e.getId()));
        ids.addAll(paymentRepo.findEntryIdsWithPaymentOn(date));
        ids.addAll(returnRepo.findEntryIdsWithReturnOn(date));

        if (ids.isEmpty()) return List.of();

        return entryRepo.findByIdInOrderBySnoAsc(new ArrayList<>(ids))
                .stream()
                .map(e -> toResponse(e, date))
                .toList();
    }

    // ── Search accounts by patient name ────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<PharmacyEntryResponse> search(String name, boolean outstandingOnly) {
        if (name == null || name.isBlank()) return List.of();
        return entryRepo.searchByName(name.trim())
                .stream()
                .map(e -> toResponse(e, null))
                .filter(r -> !outstandingOnly || r.getOutstanding().signum() != 0)
                .toList();
    }

    // ── Create purchase account ────────────────────────────────────────────────

    public PharmacyEntryResponse create(PharmacyEntryRequest req) {
        log.info("[PHARMACY] create account date={} patient='{}' total={}",
                req.getEntryDate(), req.getPatientName(), req.getTotalAmount());

        int sno = entryRepo.countByEntryDate(req.getEntryDate()) + 1;

        // Standalone register: there is no fixed medicine total. Default the account
        // total to the amount collected now (or 0) so outstanding stays at zero.
        BigDecimal total = req.getTotalAmount() != null ? req.getTotalAmount()
                : (req.getAdvanceAmount() != null ? req.getAdvanceAmount() : BigDecimal.ZERO);
        BigDecimal gross = req.getGrossAmount() != null ? req.getGrossAmount() : total;

        PharmacyEntry entry = PharmacyEntry.builder()
                .entryNo(generateEntryNo())
                .entryDate(req.getEntryDate())
                .sno(sno)
                .patientName(req.getPatientName())
                .insuranceName(req.getInsuranceName())
                .grossAmount(gross)
                .totalAmount(total)
                .notes(req.getNotes())
                .build();

        PharmacyEntry savedEntry = entryRepo.save(entry);

        // Record the optional initial advance payment
        if (req.getAdvanceAmount() != null && req.getAdvanceAmount().signum() > 0) {
            PharmacyPaymentMode mode = req.getAdvancePaymentMode() != null
                    ? req.getAdvancePaymentMode() : PharmacyPaymentMode.CASH;
            PharmacyPayment advance = PharmacyPayment.builder()
                    .entry(savedEntry)
                    .paymentDate(req.getEntryDate())
                    .amount(req.getAdvanceAmount())
                    .paymentMode(mode)
                    .paymentSplitsJson(req.getAdvanceSplitsJson())
                    .advance(true)
                    .notes("Advance at purchase")
                    .build();
            paymentRepo.save(advance);
        }

        PharmacyEntryResponse saved = toResponse(entryRepo.save(savedEntry), req.getEntryDate());
        auditLogService.log("PharmacyEntry", saved.getId(), "CREATE", currentUser(),
                "date=" + req.getEntryDate() + " patient=" + req.getPatientName() + " total=" + req.getTotalAmount());
        return saved;
    }

    // ── Update account ─────────────────────────────────────────────────────────

    public PharmacyEntryResponse update(Long id, PharmacyEntryRequest req) {
        log.info("[PHARMACY] update account id={}", id);
        PharmacyEntry entry = findEntry(id);
        entry.setPatientName(req.getPatientName());
        entry.setInsuranceName(req.getInsuranceName());
        // Preserve the existing total when the client doesn't send one (register model)
        BigDecimal total = req.getTotalAmount() != null ? req.getTotalAmount() : entry.getTotalAmount();
        entry.setGrossAmount(req.getGrossAmount() != null ? req.getGrossAmount() : total);
        entry.setTotalAmount(total);
        entry.setNotes(req.getNotes());
        PharmacyEntryResponse saved = toResponse(entryRepo.save(entry), null);
        auditLogService.log("PharmacyEntry", id, "UPDATE", currentUser(), "patient=" + req.getPatientName());
        return saved;
    }

    // ── Delete account ─────────────────────────────────────────────────────────

    public void delete(Long id) {
        log.info("[PHARMACY] delete account id={}", id);
        if (!entryRepo.existsById(id))
            throw new ResourceNotFoundException("PharmacyEntry", id);
        entryRepo.deleteById(id);
        auditLogService.log("PharmacyEntry", id, "DELETE", currentUser(), "id=" + id);
    }

    // ── Payments (advance + top-ups) ───────────────────────────────────────────

    public PharmacyPaymentResponse addPayment(Long entryId, PharmacyPaymentRequest req) {
        log.info("[PHARMACY] addPayment entryId={} amount={}", entryId, req.getAmount());
        PharmacyEntry entry = findEntry(entryId);

        PharmacyPayment payment = PharmacyPayment.builder()
                .entry(entry)
                .paymentDate(req.getPaymentDate())
                .amount(req.getAmount())
                .paymentMode(req.getPaymentMode())
                .paymentSplitsJson(req.getPaymentSplitsJson())
                .advance(false)
                .notes(req.getNotes())
                .build();

        PharmacyPaymentResponse saved = toPaymentResponse(paymentRepo.save(payment));
        auditLogService.log("PharmacyPayment", saved.getId(), "CREATE", currentUser(),
                "entryId=" + entryId + " amount=" + req.getAmount());
        return saved;
    }

    public void deletePayment(Long entryId, Long paymentId) {
        log.info("[PHARMACY] deletePayment entryId={} paymentId={}", entryId, paymentId);
        PharmacyPayment p = paymentRepo.findById(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("PharmacyPayment", paymentId));
        if (!p.getEntry().getId().equals(entryId)) {
            throw new IllegalArgumentException("Payment " + paymentId + " does not belong to account " + entryId);
        }
        paymentRepo.deleteById(paymentId);
        auditLogService.log("PharmacyPayment", paymentId, "DELETE", currentUser(), "entryId=" + entryId);
    }

    // ── Returns ────────────────────────────────────────────────────────────────

    public PharmacyReturnResponse addReturn(Long entryId, PharmacyReturnRequest req) {
        log.info("[PHARMACY] addReturn entryId={} amount={}", entryId, req.getReturnAmount());
        PharmacyEntry entry = findEntry(entryId);

        // Standalone register: a return is simply cash paid back to the patient.
        // There is no fixed medicine total to cap it against.

        PharmacyReturn ret = PharmacyReturn.builder()
                .entry(entry)
                .returnDate(req.getReturnDate())
                .returnAmount(req.getReturnAmount())
                .paymentMode(req.getPaymentMode())
                .notes(req.getNotes())
                .build();

        PharmacyReturnResponse saved = toReturnResponse(returnRepo.save(ret));
        auditLogService.log("PharmacyReturn", saved.getId(), "CREATE", currentUser(),
                "entryId=" + entryId + " amount=" + req.getReturnAmount());

        // No auto cash-refund payment: in the register model the return record itself
        // represents the cash paid back and already reduces the day's net collection.

        return saved;
    }

    public void deleteReturn(Long entryId, Long returnId) {
        log.info("[PHARMACY] deleteReturn entryId={} returnId={}", entryId, returnId);
        PharmacyReturn ret = returnRepo.findById(returnId)
                .orElseThrow(() -> new ResourceNotFoundException("PharmacyReturn", returnId));
        if (!ret.getEntry().getId().equals(entryId)) {
            throw new IllegalArgumentException("Return " + returnId + " does not belong to account " + entryId);
        }
        returnRepo.deleteById(returnId);
        auditLogService.log("PharmacyReturn", returnId, "DELETE", currentUser(), "entryId=" + entryId);
    }

    // ── Mapping helpers ────────────────────────────────────────────────────────

    /** @param onDate when non-null, computes collectedOnDate / returnedOnDate for that day */
    private PharmacyEntryResponse toResponse(PharmacyEntry e, LocalDate onDate) {
        List<PharmacyPayment> payments = paymentRepo.findByEntryIdOrderByPaymentDateAscIdAsc(e.getId());
        List<PharmacyReturn>  returns  = returnRepo.findByEntryIdOrderByReturnDateAsc(e.getId());

        BigDecimal paidToDate = payments.stream()
                .filter(p -> p.getAmount().compareTo(BigDecimal.ZERO) > 0)
                .map(PharmacyPayment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalReturned = returns.stream()
                .map(PharmacyReturn::getReturnAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal outstanding = e.getTotalAmount().subtract(totalReturned).subtract(paidToDate);

        PharmacyEntryResponse r = new PharmacyEntryResponse();
        r.setId(e.getId());
        r.setEntryNo(e.getEntryNo());
        r.setEntryDate(e.getEntryDate());
        r.setSno(e.getSno());
        r.setPatientName(e.getPatientName());
        r.setInsuranceName(e.getInsuranceName());
        r.setTotalAmount(e.getTotalAmount());
        r.setGrossAmount(e.getGrossAmount());
        r.setPaidToDate(paidToDate);
        r.setTotalReturned(totalReturned);
        r.setOutstanding(outstanding);
        r.setNotes(e.getNotes());
        r.setCreatedAt(e.getCreatedAt());
        r.setPayments(payments.stream().map(this::toPaymentResponse).toList());
        r.setReturns(returns.stream().map(this::toReturnResponse).toList());

        if (onDate != null) {
            // Sum only positive payments on this date (negative = cash refund payout, excluded)
            BigDecimal paymentsToday = payments.stream()
                    .filter(p -> onDate.equals(p.getPaymentDate()) && p.getAmount().compareTo(BigDecimal.ZERO) > 0)
                    .map(PharmacyPayment::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal returnedToday = returns.stream()
                    .filter(rt -> onDate.equals(rt.getReturnDate()))
                    .map(PharmacyReturn::getReturnAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            // Net collected today = cash received today − tablets returned today
            BigDecimal collectedToday = paymentsToday.subtract(returnedToday);
            r.setCollectedOnDate(collectedToday);
            r.setReturnedOnDate(returnedToday);
        } else {
            r.setCollectedOnDate(BigDecimal.ZERO);
            r.setReturnedOnDate(BigDecimal.ZERO);
        }
        return r;
    }

    private PharmacyPaymentResponse toPaymentResponse(PharmacyPayment p) {
        PharmacyPaymentResponse resp = new PharmacyPaymentResponse();
        resp.setId(p.getId());
        resp.setEntryId(p.getEntry().getId());
        resp.setPaymentDate(p.getPaymentDate());
        resp.setAmount(p.getAmount());
        resp.setPaymentMode(p.getPaymentMode().name());
        resp.setPaymentSplitsJson(p.getPaymentSplitsJson());
        resp.setAdvance(p.isAdvance());
        resp.setNotes(p.getNotes());
        resp.setCreatedAt(p.getCreatedAt());
        return resp;
    }

    private PharmacyReturnResponse toReturnResponse(PharmacyReturn r) {
        PharmacyReturnResponse resp = new PharmacyReturnResponse();
        resp.setId(r.getId());
        resp.setEntryId(r.getEntry().getId());
        resp.setReturnDate(r.getReturnDate());
        resp.setReturnAmount(r.getReturnAmount());
        resp.setPaymentMode(r.getPaymentMode().name());
        resp.setNotes(r.getNotes());
        resp.setCreatedAt(r.getCreatedAt());
        return resp;
    }

    private PharmacyEntry findEntry(Long id) {
        return entryRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("PharmacyEntry", id));
    }

    // ── Entry number generation ────────────────────────────────────────────────

    private String generateEntryNo() {
        int seq = entryRepo.findMaxSequence() + 1;
        return "PHR-" + String.format("%04d", seq);
    }

    // ── Current user ───────────────────────────────────────────────────────────

    private String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return "system";
        }
        return auth.getPrincipal().toString();
    }
}
