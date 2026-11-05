package com.hms.modules.dailysummary.service;

import com.hms.exception.DuplicateResourceException;
import com.hms.exception.ResourceNotFoundException;
import com.hms.modules.billing.entity.Bill;
import com.hms.modules.billing.entity.PaymentRecord;
import com.hms.modules.billing.enums.BillStatus;
import com.hms.modules.billing.repository.BillRepository;
import com.hms.modules.dailysummary.dto.DailySummaryResponse;
import com.hms.modules.dailysummary.dto.DailySummaryResponse.*;
import com.hms.modules.dailysummary.dto.ManualEntryRequest;
import com.hms.modules.dailysummary.entity.DailySummaryEntry;
import com.hms.modules.dailysummary.entity.DailySummaryLock;
import com.hms.modules.dailysummary.repository.DailySummaryEntryRepository;
import com.hms.modules.dailysummary.repository.DailySummaryLockRepository;
import com.hms.modules.expense.entity.Expense;
import com.hms.modules.expense.repository.ExpenseRepository;
import com.hms.modules.insurance.entity.InsuranceClaim;
import com.hms.modules.insurance.enums.ClaimStatus;
import com.hms.modules.insurance.repository.InsuranceClaimRepository;
import com.hms.modules.opvisit.repository.OPVisitRepository;
import com.hms.modules.admission.repository.AdmissionRepository;
import com.hms.modules.admission.enums.AdmissionStatus;
import com.hms.modules.appointment.repository.AppointmentRepository;
import com.hms.common.AuditLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class DailySummaryService {

    private final BillRepository billRepo;
    private final InsuranceClaimRepository claimRepo;
    private final ExpenseRepository expenseRepo;
    private final OPVisitRepository opVisitRepo;
    private final AdmissionRepository admissionRepo;
    private final AppointmentRepository appointmentRepo;
    private final DailySummaryEntryRepository entryRepo;
    private final DailySummaryLockRepository lockRepo;
    private final AuditLogService auditLogService;

    // ── Get full daily summary ────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public DailySummaryResponse getSummary(LocalDate date) {
        DailySummaryResponse resp = new DailySummaryResponse();
        resp.setDate(date);

        // Lock status
        lockRepo.findBySummaryDate(date).ifPresentOrElse(lock -> {
            resp.setStatus(lock.getStatus());
            resp.setSubmittedBy(lock.getSubmittedBy());
            resp.setSubmittedAt(lock.getSubmittedAt());
        }, () -> resp.setStatus("DRAFT"));

        // ── Bills ─────────────────────────────────────────────────────────────
        // Pull all bills for the date (by payment records created on that date)
        List<Bill> bills = billRepo.findAll().stream()
                .filter(b -> b.getStatus() != BillStatus.CANCELLED
                        && b.getStatus() != BillStatus.DRAFT
                        && b.getDate().equals(date))
                .toList();

        List<BillSummaryItem> billItems = bills.stream().map(b -> {
            BillSummaryItem item = new BillSummaryItem();
            item.setBillNo(b.getBillNo());
            item.setPatientName(b.getPatientName());
            item.setUhid(b.getUhid());
            item.setPatientType(b.getPatientType());
            item.setDoctorName(b.getDoctorName());
            item.setTotalAmount(b.getTotalAmount());
            item.setPaidAmount(b.getPaidAmount());
            item.setPaymentMode(b.getPaymentMode() != null ? b.getPaymentMode().name() : "CASH");
            item.setStatus(b.getStatus().name());
            return item;
        }).toList();
        resp.setBills(billItems);

        // Bill payment mode breakdown — sum from payment records on that date
        BigDecimal billCash = BigDecimal.ZERO, billCard = BigDecimal.ZERO,
                billUpi = BigDecimal.ZERO, billCheque = BigDecimal.ZERO,
                billIns = BigDecimal.ZERO, billPaid = BigDecimal.ZERO;

        for (Bill b : bills) {
            for (PaymentRecord pr : b.getPayments()) {
                if (pr.getDate() != null && pr.getDate().equals(date)) {
                    billPaid = billPaid.add(pr.getAmount());
                    if (pr.getPaymentMode() != null) {
                        switch (pr.getPaymentMode()) {
                            case CASH      -> billCash   = billCash.add(pr.getAmount());
                            case CARD      -> billCard   = billCard.add(pr.getAmount());
                            case UPI       -> billUpi    = billUpi.add(pr.getAmount());
                            case CHEQUE    -> billCheque = billCheque.add(pr.getAmount());
                            case INSURANCE -> billIns    = billIns.add(pr.getAmount());
                        }
                    }
                }
            }
        }
        resp.setTotalBillAmount(bills.stream().map(Bill::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add));
        resp.setTotalBillPaid(billPaid);
        resp.setBillCash(billCash);
        resp.setBillCard(billCard);
        resp.setBillUpi(billUpi);
        resp.setBillCheque(billCheque);
        resp.setBillInsurance(billIns);

        // ── Insurance Claims ──────────────────────────────────────────────────
        List<InsuranceClaim> claimsToday = claimRepo.findAll().stream()
                .filter(c -> c.getSubmittedDate().equals(date))
                .toList();

        List<ClaimSummaryItem> claimItems = claimsToday.stream().map(c -> {
            ClaimSummaryItem item = new ClaimSummaryItem();
            item.setClaimNo(c.getClaimNo());
            item.setBillNo(c.getBillNo());
            item.setPatientName(c.getPatientName());
            item.setInsuranceCompany(c.getInsuranceCompany());
            item.setClaimedAmount(c.getClaimedAmount());
            item.setSettledAmount(c.getSettledAmount());
            item.setStatus(c.getStatus().name());
            return item;
        }).toList();
        resp.setClaims(claimItems);
        resp.setTotalClaimsSubmitted(claimsToday.stream()
                .map(InsuranceClaim::getClaimedAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        resp.setTotalClaimsSettled(claimsToday.stream()
                .filter(c -> c.getStatus() == ClaimStatus.SETTLED && c.getSettledAmount() != null)
                .map(InsuranceClaim::getSettledAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add));

        // ── Expenses ──────────────────────────────────────────────────────────
        List<Expense> expenses = expenseRepo.findAll().stream()
                .filter(e -> e.getDate().equals(date))
                .toList();

        List<ExpenseSummaryItem> expItems = expenses.stream().map(e -> {
            ExpenseSummaryItem item = new ExpenseSummaryItem();
            item.setExpenseNo(e.getExpenseNo());
            item.setCategory(e.getCategory());
            item.setTowards(e.getTowards());
            item.setAmount(e.getAmount());
            item.setPaymentMode(e.getPaymentMode().name());
            item.setStatus(e.getStatus().name());
            return item;
        }).toList();
        resp.setExpenses(expItems);

        BigDecimal expCash = BigDecimal.ZERO, expUpi = BigDecimal.ZERO,
                expCheque = BigDecimal.ZERO, expBank = BigDecimal.ZERO;
        for (Expense e : expenses) {
            BigDecimal amt = e.getAmount();
            switch (e.getPaymentMode()) {
                case CASH           -> expCash   = expCash.add(amt);
                case UPI            -> expUpi    = expUpi.add(amt);
                case CHEQUE         -> expCheque = expCheque.add(amt);
                case BANK_TRANSFER  -> expBank   = expBank.add(amt);
                default             -> {}
            }
        }
        resp.setTotalExpenses(expenses.stream().map(Expense::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add));
        resp.setExpenseCash(expCash);
        resp.setExpenseUpi(expUpi);
        resp.setExpenseCheque(expCheque);
        resp.setExpenseBankTransfer(expBank);

        // ── Manual entries ────────────────────────────────────────────────────
        List<DailySummaryEntry> manualList = entryRepo.findByEntryDateOrderBySnoAsc(date);
        List<ManualEntryResponse> manualItems = manualList.stream().map(this::toEntryResponse).toList();
        resp.setManualEntries(manualItems);

        BigDecimal mCash = BigDecimal.ZERO, mUpi = BigDecimal.ZERO,
                mCard = BigDecimal.ZERO, mCheque = BigDecimal.ZERO, mTotal = BigDecimal.ZERO;
        for (DailySummaryEntry e : manualList) {
            mTotal = mTotal.add(e.getAmount());
            switch (e.getPaymentMode().toUpperCase()) {
                case "CASH"   -> mCash   = mCash.add(e.getAmount());
                case "UPI"    -> mUpi    = mUpi.add(e.getAmount());
                case "CARD"   -> mCard   = mCard.add(e.getAmount());
                case "CHEQUE" -> mCheque = mCheque.add(e.getAmount());
                default       -> {}
            }
        }
        resp.setManualEntries(manualItems);
        resp.setManualTotal(mTotal);
        resp.setManualCash(mCash);
        resp.setManualUpi(mUpi);
        resp.setManualCard(mCard);
        resp.setManualCheque(mCheque);

        // ── Counts ────────────────────────────────────────────────────────────
        resp.setOpVisitCount(opVisitRepo.countByVisitDate(date));
        resp.setAdmittedCount(admissionRepo.countByAdmissionDate(date));
        resp.setDischargedCount(admissionRepo.countByStatus(AdmissionStatus.DISCHARGED));
        resp.setAppointmentCount(appointmentRepo.countByDate(date));

        // ── Net totals ────────────────────────────────────────────────────────
        BigDecimal totalIncome = billPaid.add(mTotal);
        BigDecimal totalExpense = resp.getTotalExpenses();
        resp.setTotalIncome(totalIncome);
        resp.setTotalExpense(totalExpense);
        resp.setNetCollection(totalIncome.subtract(totalExpense));

        return resp;
    }

    // ── Manual entry CRUD ─────────────────────────────────────────────────────

    public ManualEntryResponse addManualEntry(ManualEntryRequest req) {
        log.info("[DAILY_SUMMARY] addManualEntry date={} patient='{}' amount={}", req.getEntryDate(), req.getPatientName(), req.getAmount());
        int nextSno = entryRepo.countByEntryDate(req.getEntryDate()) + 1;
        DailySummaryEntry entry = DailySummaryEntry.builder()
                .entryDate(req.getEntryDate())
                .sno(nextSno)
                .patientName(req.getPatientName())
                .age(req.getAge())
                .sex(req.getSex())
                .visitType(req.getVisitType())
                .consultantName(req.getConsultantName())
                .diagnosis(req.getDiagnosis())
                .paymentMode(req.getPaymentMode())
                .amount(req.getAmount())
                .paymentSplitsJson(req.getPaymentSplitsJson())
                .notes(req.getNotes())
                .build();
        ManualEntryResponse meSaved = toEntryResponse(entryRepo.save(entry));
        auditLogService.log("DailySummaryEntry", meSaved.getId(), "CREATE", currentUser(), "date=" + req.getEntryDate() + " patient=" + req.getPatientName() + " amount=" + req.getAmount());
        return meSaved;
    }

    public ManualEntryResponse updateManualEntry(Long id, ManualEntryRequest req) {
        log.info("[DAILY_SUMMARY] updateManualEntry id={}", id);
        DailySummaryEntry entry = entryRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Manual entry", id));
        entry.setPatientName(req.getPatientName());
        entry.setAge(req.getAge());
        entry.setSex(req.getSex());
        entry.setVisitType(req.getVisitType());
        entry.setConsultantName(req.getConsultantName());
        entry.setDiagnosis(req.getDiagnosis());
        entry.setPaymentMode(req.getPaymentMode());
        entry.setAmount(req.getAmount());
        entry.setPaymentSplitsJson(req.getPaymentSplitsJson());
        entry.setNotes(req.getNotes());
        ManualEntryResponse meSaved = toEntryResponse(entryRepo.save(entry));
        auditLogService.log("DailySummaryEntry", meSaved.getId(), "CREATE", currentUser(), "date=" + req.getEntryDate() + " patient=" + req.getPatientName() + " amount=" + req.getAmount());
        return meSaved;
    }

    public void deleteManualEntry(Long id) {
        log.info("[DAILY_SUMMARY] deleteManualEntry id={}", id);
        if (!entryRepo.existsById(id))
            throw new ResourceNotFoundException("Manual entry", id);
        entryRepo.deleteById(id);
        auditLogService.log("DailySummaryEntry", id, "DELETE", currentUser(), "id=" + id);
    }

    // ── Submit / lock ─────────────────────────────────────────────────────────

    public void submit(LocalDate date, String submittedBy) {
        log.info("[DAILY_SUMMARY] submit date={} by='{}'", date, submittedBy);
        DailySummaryLock lock = lockRepo.findBySummaryDate(date)
                .orElse(DailySummaryLock.builder().summaryDate(date).build());
        if ("SUBMITTED".equals(lock.getStatus())) {
            throw new DuplicateResourceException("Daily summary for " + date + " is already submitted");
        }
        lock.setStatus("SUBMITTED");
        lock.setSubmittedBy(submittedBy);
        lock.setSubmittedAt(LocalDateTime.now());
        lockRepo.save(lock);
        auditLogService.log("DailySummary", null, "SUBMIT", submittedBy, "date=" + date);
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private ManualEntryResponse toEntryResponse(DailySummaryEntry e) {
        ManualEntryResponse r = new ManualEntryResponse();
        r.setId(e.getId());
        r.setSno(e.getSno());
        r.setPatientName(e.getPatientName());
        r.setAge(e.getAge());
        r.setSex(e.getSex());
        r.setVisitType(e.getVisitType());
        r.setConsultantName(e.getConsultantName());
        r.setDiagnosis(e.getDiagnosis());
        r.setPaymentMode(e.getPaymentMode());
        r.setAmount(e.getAmount());
        r.setPaymentSplitsJson(e.getPaymentSplitsJson());
        r.setNotes(e.getNotes());
        r.setCreatedAt(e.getCreatedAt());
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