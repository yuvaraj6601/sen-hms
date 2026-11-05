package com.hms.modules.dashboard.service;

import com.hms.modules.admission.enums.AdmissionStatus;
import com.hms.modules.admission.repository.AdmissionRepository;
import com.hms.modules.appointment.repository.AppointmentRepository;
import com.hms.modules.billing.enums.BillStatus;
import com.hms.modules.billing.repository.BillRepository;
import com.hms.modules.dailysummary.repository.DailySummaryEntryRepository;
import com.hms.modules.dashboard.dto.DashboardSummaryResponse;
import com.hms.modules.dashboard.dto.MonthlyRevenueResponse;
import com.hms.modules.dashboard.dto.MonthlyRevenueResponse.MonthData;
import com.hms.modules.expense.repository.ExpenseRepository;
import com.hms.modules.insurance.enums.ClaimStatus;
import com.hms.modules.insurance.repository.InsuranceClaimRepository;
import com.hms.modules.lab.enums.LabPriority;
import com.hms.modules.lab.enums.LabStatus;
import com.hms.modules.lab.repository.LabInvestigationRepository;
import com.hms.modules.opvisit.repository.OPVisitRepository;
import com.hms.masters.repository.BedRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardService {

    private final OPVisitRepository opVisitRepo;
    private final AdmissionRepository admissionRepo;
    private final AppointmentRepository appointmentRepo;
    private final BillRepository billRepo;
    private final InsuranceClaimRepository claimRepo;
    private final LabInvestigationRepository labRepo;
    private final ExpenseRepository expenseRepo;
    private final BedRepository bedRepo;
    private final DailySummaryEntryRepository entryRepo;

    private static final String[] MONTH_LABELS = {
        "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    };

    public DashboardSummaryResponse getSummary(LocalDate date) {

        // ── Patients ──────────────────────────────────────────────────────────
        long todayOp          = opVisitRepo.countByVisitDate(date);
        long todayAdmissions  = admissionRepo.countByAdmissionDate(date);
        long currentIP        = admissionRepo.countByStatus(AdmissionStatus.ADMITTED)
                              + admissionRepo.countByStatus(AdmissionStatus.STABLE)
                              + admissionRepo.countByStatus(AdmissionStatus.CRITICAL)
                              + admissionRepo.countByStatus(AdmissionStatus.SERIOUS)
                              + admissionRepo.countByStatus(AdmissionStatus.UNDER_OBSERVATION)
                              + admissionRepo.countByStatus(AdmissionStatus.DISCHARGE_INITIATED);
        long todayDischarges  = admissionRepo.countByStatus(AdmissionStatus.DISCHARGED);
        long todayAppts       = appointmentRepo.countByDate(date);

        // ── Beds ──────────────────────────────────────────────────────────────
        long totalBeds    = bedRepo.count();
        long occupiedBeds = bedRepo.findAll().stream()
                .filter(b -> b.getStatus() == com.hms.masters.entity.Bed.BedStatus.OCCUPIED)
                .count();
        long availBeds = totalBeds - occupiedBeds;
        double occPct  = totalBeds > 0
                ? Math.round((occupiedBeds * 100.0 / totalBeds) * 10.0) / 10.0
                : 0.0;

        // ── Revenue ───────────────────────────────────────────────────────────
        BigDecimal todayRevenue   = billRepo.sumPaidAmountByDate(date);
        BigDecimal pendingBillAmt = billRepo.sumTotalDue();

        // ── Insurance ─────────────────────────────────────────────────────────
        // Pending = any claim in the pipeline that is not yet SETTLED and not
        // DECLINED (sent for approval, approved, or claimed). DECLINED is a
        // terminal off-ramp — the insurer pays nothing, so it is NOT pending.
        long pendingClaimsCount = claimRepo.countByStatus(ClaimStatus.SENT_FOR_APPROVAL)
                                + claimRepo.countByStatus(ClaimStatus.APPROVED)
                                + claimRepo.countByStatus(ClaimStatus.CLAIMED);
        BigDecimal pendingClaimsAmt = claimRepo.findAll().stream()
                .filter(c -> c.getStatus() == ClaimStatus.SENT_FOR_APPROVAL
                          || c.getStatus() == ClaimStatus.APPROVED
                          || c.getStatus() == ClaimStatus.CLAIMED)
                .map(c -> c.getClaimedAmount() != null ? c.getClaimedAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // ── Lab ───────────────────────────────────────────────────────────────
        long labPending    = labRepo.countByStatus(LabStatus.PENDING);
        long labInProgress = labRepo.countByStatus(LabStatus.IN_PROGRESS);
        long labStat       = labRepo.countByStatusAndPriority(LabStatus.PENDING, LabPriority.STAT);

        // ── Expenses this month ───────────────────────────────────────────────
        YearMonth month = YearMonth.from(date);
        BigDecimal monthlyExp = expenseRepo.findAll().stream()
                .filter(e -> !e.getDate().isBefore(month.atDay(1))
                          && !e.getDate().isAfter(month.atEndOfMonth()))
                .map(com.hms.modules.expense.entity.Expense::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return DashboardSummaryResponse.builder()
                .date(date)
                .todayOpVisits(todayOp)
                .todayAdmissions(todayAdmissions)
                .currentInpatients(currentIP)
                .todayDischarges(todayDischarges)
                .todayAppointments(todayAppts)
                .totalBeds((int) totalBeds)
                .occupiedBeds((int) occupiedBeds)
                .availableBeds((int) availBeds)
                .occupancyPercent(occPct)
                .todayRevenue(todayRevenue != null ? todayRevenue : BigDecimal.ZERO)
                .pendingBillsTotal(pendingBillAmt != null ? pendingBillAmt : BigDecimal.ZERO)
                .pendingClaimsCount(pendingClaimsCount)
                .pendingClaimsAmount(pendingClaimsAmt)
                .labPendingCount(labPending)
                .labInProgressCount(labInProgress)
                .labStatCount(labStat)
                .monthlyExpenses(monthlyExp)
                // Free patients today = free OP visits + free IP admissions (per-episode facts).
                .freePatientCount(opVisitRepo.countFreeInRange(date, date)
                                + admissionRepo.countFreeInRange(date, date))
                .build();
    }

    /**
     * Monthly revenue breakdown for the chart.
     * Aggregates: bills paid + insurance settled + manual cash entries,
     * grouped by month for the requested year (defaults to current year).
     */
    public MonthlyRevenueResponse getMonthlyRevenue(int year) {

        // Build month → amount maps from each source
        Map<Integer, BigDecimal> billMap     = toMonthMap(billRepo.sumPaidAmountByMonth(year));
        Map<Integer, BigDecimal> insurMap    = toMonthMap(claimRepo.sumSettledAmountByMonth(year));
        Map<Integer, BigDecimal> manualMap   = toMonthMap(entryRepo.sumAmountByMonth(year));

        List<MonthData> months = new ArrayList<>(12);
        BigDecimal totalBill   = BigDecimal.ZERO;
        BigDecimal totalInsur  = BigDecimal.ZERO;
        BigDecimal totalManual = BigDecimal.ZERO;

        for (int m = 1; m <= 12; m++) {
            BigDecimal bill   = billMap.getOrDefault(m,   BigDecimal.ZERO);
            BigDecimal insur  = insurMap.getOrDefault(m,  BigDecimal.ZERO);
            BigDecimal manual = manualMap.getOrDefault(m, BigDecimal.ZERO);
            BigDecimal total  = bill.add(insur).add(manual);

            months.add(new MonthData(m, MONTH_LABELS[m], bill, insur, manual, total));
            totalBill   = totalBill.add(bill);
            totalInsur  = totalInsur.add(insur);
            totalManual = totalManual.add(manual);
        }

        BigDecimal grandTotal = totalBill.add(totalInsur).add(totalManual);
        return new MonthlyRevenueResponse(year, months, totalBill, totalInsur, totalManual, grandTotal);
    }

    /** Convert JPQL [month, sum] rows into a Map<month, BigDecimal>. */
    private Map<Integer, BigDecimal> toMonthMap(List<Object[]> rows) {
        Map<Integer, BigDecimal> map = new HashMap<>();
        for (Object[] row : rows) {
            int month = ((Number) row[0]).intValue();
            BigDecimal amount = row[1] instanceof BigDecimal
                    ? (BigDecimal) row[1]
                    : BigDecimal.valueOf(((Number) row[1]).doubleValue());
            map.put(month, amount);
        }
        return map;
    }
}
