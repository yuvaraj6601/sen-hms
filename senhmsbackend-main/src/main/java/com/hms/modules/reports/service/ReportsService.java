package com.hms.modules.reports.service;

import com.hms.modules.admission.repository.AdmissionRepository;
import com.hms.modules.billing.repository.BillRepository;
import com.hms.modules.dailysummary.repository.DailySummaryEntryRepository;
import com.hms.modules.expense.repository.ExpenseRepository;
import com.hms.modules.insurance.repository.InsuranceClaimRepository;
import com.hms.modules.billing.repository.PaymentRecordRepository;
import com.hms.modules.opvisit.repository.OPVisitRepository;
import com.hms.modules.reports.dto.FinancialReportResponse;
import com.hms.modules.reports.dto.PatientReportResponse;
import com.hms.modules.reports.dto.PatientReportResponse.Bucket;
import com.hms.modules.reports.dto.PatientReportResponse.Totals;
import com.hms.modules.reports.dto.StatisticsReportResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Year;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Aggregated statistics reports for the Reports menu.
 *
 * All metrics are computed over an inclusive date range resolved from a
 * {@code periodType} (DAY / MONTH / YEAR) and a reference date.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportsService {

    private final OPVisitRepository opVisitRepo;
    private final AdmissionRepository admissionRepo;
    private final BillRepository billRepo;
    private final DailySummaryEntryRepository manualEntryRepo;
    private final InsuranceClaimRepository claimRepo;
    private final ExpenseRepository expenseRepo;
    private final PaymentRecordRepository paymentRepo;

    /**
     * Build the statistics report for the given period.
     *
     * @param periodType DAY, MONTH or YEAR (case-insensitive; defaults to DAY)
     * @param refDate    any date inside the desired period (defaults to today)
     */
    public StatisticsReportResponse getStatistics(String periodType, LocalDate refDate) {
        String type = normalisePeriod(periodType);
        LocalDate ref = refDate != null ? refDate : LocalDate.now();

        LocalDate from;
        LocalDate to;
        switch (type) {
            case "MONTH" -> {
                YearMonth ym = YearMonth.from(ref);
                from = ym.atDay(1);
                to = ym.atEndOfMonth();
            }
            case "YEAR" -> {
                Year y = Year.from(ref);
                from = y.atDay(1);
                to = LocalDate.of(y.getValue(), 12, 31);
            }
            default -> { // DAY
                from = ref;
                to = ref;
            }
        }

        // ── Patient counts ──────────────────────────────────────────────────
        long opCount = opVisitRepo.countInRange(from, to);
        long opFree = opVisitRepo.countFreeInRange(from, to);
        long ipCount = admissionRepo.countInRange(from, to);
        long ipFree = admissionRepo.countFreeInRange(from, to);
        long insuranceCount = admissionRepo.countInsuranceInRange(from, to);

        // ── IP category breakdown (insurance vs non-insurance) ───────────────
        // Surgical split is a later phase — for now all cases are non-surgical.
        long ipInsSurg = 0, ipInsNonSurg = 0, ipNonInsSurg = 0, ipNonInsNonSurg = 0;
        for (Object[] row : admissionRepo.ipCategoryMatrixInRange(from, to)) {
            boolean isInsurance = toBoolean(row[0]);
            boolean isSurgical = toBoolean(row[1]);
            long count = num(row[2]);
            if (isInsurance && isSurgical) ipInsSurg = count;
            else if (isInsurance) ipInsNonSurg = count;
            else if (isSurgical) ipNonInsSurg = count;
            else ipNonInsNonSurg = count;
        }

        // ── Financials ──────────────────────────────────────────────────────
        BigDecimal billIncome = nz(billRepo.sumPaidAmountInRange(from, to));
        BigDecimal manualIncome = nz(manualEntryRepo.sumAmountInRange(from, to));
        BigDecimal insuranceIncome = nz(claimRepo.sumSettledAmountInRange(from, to));
        BigDecimal totalIncome = billIncome.add(manualIncome).add(insuranceIncome);
        BigDecimal totalExpense = nz(expenseRepo.sumAmountInRange(from, to));
        BigDecimal netCash = totalIncome.subtract(totalExpense);

        return StatisticsReportResponse.builder()
                .periodType(type)
                .fromDate(from)
                .toDate(to)
                .opCount(opCount)
                .opFreeCount(opFree)
                .ipCount(ipCount)
                .ipFreeCount(ipFree)
                .freePatientCount(opFree + ipFree)
                .insurancePatientCount(insuranceCount)
                .ipInsuranceSurgical(ipInsSurg)
                .ipInsuranceNonSurgical(ipInsNonSurg)
                .ipNonInsuranceSurgical(ipNonInsSurg)
                .ipNonInsuranceNonSurgical(ipNonInsNonSurg)
                .totalIncome(totalIncome)
                .billIncome(billIncome)
                .manualIncome(manualIncome)
                .insuranceIncome(insuranceIncome)
                .totalExpense(totalExpense)
                .netCash(netCash)
                .build();
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Patient Report Generator — from..to range, grouped by DAY/MONTH/YEAR
    // ══════════════════════════════════════════════════════════════════════════

    private static final String[] MONTH_LABELS = {
        "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    };

    /**
     * Dynamic patient-count report.
     *
     * @param from       inclusive range start (defaults to today)
     * @param to         inclusive range end   (defaults to today)
     * @param groupBy    DAY | MONTH | YEAR (defaults to DAY)
     * @param department optional department filter (null = all)
     */
    public PatientReportResponse getPatientReport(LocalDate from, LocalDate to,
                                                  String groupBy, String department) {
        String gb = normaliseGroupBy(groupBy);
        LocalDate today = LocalDate.now();
        LocalDate f = from != null ? from : today;
        LocalDate t = to != null ? to : today;
        if (t.isBefore(f)) { LocalDate tmp = f; f = t; t = tmp; }
        String dept = StringUtils.hasText(department) ? department : null;

        // Raw daily series (only populated dates)
        Map<LocalDate, long[]> opDaily = new TreeMap<>();   // date -> [total, free]
        for (Object[] r : opVisitRepo.opDailySeries(f, t, dept)) {
            opDaily.put((LocalDate) r[0], new long[]{ num(r[1]), num(r[2]) });
        }
        Map<LocalDate, long[]> ipDaily = new TreeMap<>();   // date -> [total, free, insurance]
        for (Object[] r : admissionRepo.ipDailySeries(f, t, dept)) {
            ipDaily.put((LocalDate) r[0], new long[]{ num(r[1]), num(r[2]), num(r[3]) });
        }

        // Bucket by group-by, iterating every day so labels are ordered & complete
        Map<String, Bucket> bucketMap = new LinkedHashMap<>();
        for (LocalDate d = f; !d.isAfter(t); d = d.plusDays(1)) {
            String key = bucketKey(d, gb);
            Bucket b = bucketMap.computeIfAbsent(key, k -> {
                LocalDate start = bucketStart(k, gb);
                return Bucket.builder().label(bucketLabel(start, gb)).start(start).build();
            });

            long[] op = opDaily.get(d);
            if (op != null) {
                b.setOpTotal(b.getOpTotal() + op[0]);
                b.setOpFree(b.getOpFree() + op[1]);
            }
            long[] ip = ipDaily.get(d);
            if (ip != null) {
                b.setIpTotal(b.getIpTotal() + ip[0]);
                b.setIpFree(b.getIpFree() + ip[1]);
                b.setIpInsurance(b.getIpInsurance() + ip[2]);
            }
        }

        // Finalise derived fields per bucket + roll up totals
        Totals tot = Totals.builder().build();
        List<Bucket> buckets = new ArrayList<>(bucketMap.values());
        for (Bucket b : buckets) {
            b.setOpPaid(Math.max(0, b.getOpTotal() - b.getOpFree()));
            b.setIpNonInsurance(Math.max(0, b.getIpTotal() - b.getIpInsurance()));
            b.setCombined(b.getOpTotal() + b.getIpTotal());

            tot.setOpTotal(tot.getOpTotal() + b.getOpTotal());
            tot.setOpFree(tot.getOpFree() + b.getOpFree());
            tot.setIpTotal(tot.getIpTotal() + b.getIpTotal());
            tot.setIpFree(tot.getIpFree() + b.getIpFree());
            tot.setIpInsurance(tot.getIpInsurance() + b.getIpInsurance());
        }
        tot.setOpPaid(Math.max(0, tot.getOpTotal() - tot.getOpFree()));
        tot.setIpNonInsurance(Math.max(0, tot.getIpTotal() - tot.getIpInsurance()));
        tot.setCombined(tot.getOpTotal() + tot.getIpTotal());
        tot.setInsuranceTotal(tot.getIpInsurance());
        tot.setFreeTotal(tot.getOpFree() + tot.getIpFree());

        // IP category matrix (insurance × surgical)
        for (Object[] row : admissionRepo.ipCategoryMatrixInRange(f, t)) {
            boolean isIns = toBoolean(row[0]);
            boolean isSurg = toBoolean(row[1]);
            long c = num(row[2]);
            if (isIns && isSurg) tot.setIpInsuranceSurgical(tot.getIpInsuranceSurgical() + c);
            else if (isIns) tot.setIpInsuranceNonSurgical(tot.getIpInsuranceNonSurgical() + c);
            else if (isSurg) tot.setIpNonInsuranceSurgical(tot.getIpNonInsuranceSurgical() + c);
            else tot.setIpNonInsuranceNonSurgical(tot.getIpNonInsuranceNonSurgical() + c);
            if (isSurg) tot.setIpSurgicalTotal(tot.getIpSurgicalTotal() + c);
            else tot.setIpNonSurgicalTotal(tot.getIpNonSurgicalTotal() + c);
        }

        return PatientReportResponse.builder()
                .groupBy(gb)
                .fromDate(f)
                .toDate(t)
                .buckets(buckets)
                .totals(tot)
                .build();
    }

    // ══════════════════════════════════════════════════════════════════════════
    //  Financial Report Generator — Income / Expense / Net Cash
    // ══════════════════════════════════════════════════════════════════════════

    /**
     * @param type     INCOME | EXPENSE | NETCASH (defaults to NETCASH)
     * @param from     inclusive range start (defaults to today)
     * @param to       inclusive range end   (defaults to today)
     * @param groupBy  DAY | MONTH | YEAR (defaults to DAY)
     * @param category optional category filter (income: bill towards, expense: category name)
     */
    public FinancialReportResponse getFinancialReport(String type, LocalDate from, LocalDate to,
                                                      String groupBy, String category) {
        String t = normaliseFinType(type);
        String gb = normaliseGroupBy(groupBy);
        LocalDate today = LocalDate.now();
        LocalDate f = from != null ? from : today;
        LocalDate to2 = to != null ? to : today;
        if (to2.isBefore(f)) { LocalDate tmp = f; f = to2; to2 = tmp; }
        String cat = StringUtils.hasText(category) && !"ALL".equalsIgnoreCase(category) ? category : null;
        // For income the category filter applies to income only; for expense to expense only.
        String incomeCat = t.equals("EXPENSE") ? null : cat;
        String expenseCat = t.equals("INCOME") ? null : cat;

        boolean needIncome = !t.equals("EXPENSE");
        boolean needExpense = !t.equals("INCOME");

        // Daily raw series
        Map<LocalDate, BigDecimal[]> incomeDaily = new TreeMap<>(); // date -> [amount, txns]
        long incomeTxns = 0;
        BigDecimal incomeTotal = BigDecimal.ZERO;
        if (needIncome) {
            for (Object[] r : paymentRepo.incomeDailySeries(f, to2, incomeCat)) {
                BigDecimal amt = dec(r[1]);
                long cnt = num(r[2]);
                incomeDaily.put((LocalDate) r[0], new BigDecimal[]{ amt, BigDecimal.valueOf(cnt) });
                incomeTotal = incomeTotal.add(amt);
                incomeTxns += cnt;
            }
        }

        Map<LocalDate, BigDecimal[]> expenseDaily = new TreeMap<>();
        long expenseTxns = 0;
        BigDecimal expenseTotal = BigDecimal.ZERO;
        if (needExpense) {
            for (Object[] r : expenseRepo.expenseDailySeries(f, to2, expenseCat)) {
                BigDecimal amt = dec(r[1]);
                long cnt = num(r[2]);
                expenseDaily.put((LocalDate) r[0], new BigDecimal[]{ amt, BigDecimal.valueOf(cnt) });
                expenseTotal = expenseTotal.add(amt);
                expenseTxns += cnt;
            }
        }

        // Bucketing
        Map<String, FinancialReportResponse.Bucket> bucketMap = new LinkedHashMap<>();
        for (LocalDate d = f; !d.isAfter(to2); d = d.plusDays(1)) {
            String key = bucketKey(d, gb);
            FinancialReportResponse.Bucket b = bucketMap.computeIfAbsent(key, k -> {
                LocalDate start = bucketStart(k, gb);
                return FinancialReportResponse.Bucket.builder()
                        .label(bucketLabel(start, gb)).start(start)
                        .income(BigDecimal.ZERO).expense(BigDecimal.ZERO).netCash(BigDecimal.ZERO)
                        .build();
            });
            BigDecimal[] inc = incomeDaily.get(d);
            if (inc != null) {
                b.setIncome(b.getIncome().add(inc[0]));
                b.setIncomeTxns(b.getIncomeTxns() + inc[1].longValue());
            }
            BigDecimal[] exp = expenseDaily.get(d);
            if (exp != null) {
                b.setExpense(b.getExpense().add(exp[0]));
                b.setExpenseTxns(b.getExpenseTxns() + exp[1].longValue());
            }
            b.setNetCash(b.getIncome().subtract(b.getExpense()));
        }
        List<FinancialReportResponse.Bucket> buckets = new ArrayList<>(bucketMap.values());

        // Category breakdown for the active type
        List<FinancialReportResponse.CategoryRow> catRows = new ArrayList<>();
        if (t.equals("INCOME")) {
            for (Object[] r : paymentRepo.incomeCategorySeries(f, to2, incomeCat)) {
                catRows.add(FinancialReportResponse.CategoryRow.builder()
                        .category(String.valueOf(r[0])).amount(dec(r[1])).txns(num(r[2])).build());
            }
        } else if (t.equals("EXPENSE")) {
            for (Object[] r : expenseRepo.expenseCategorySeries(f, to2, expenseCat)) {
                catRows.add(FinancialReportResponse.CategoryRow.builder()
                        .category(String.valueOf(r[0])).amount(dec(r[1])).txns(num(r[2])).build());
            }
        }

        BigDecimal net = incomeTotal.subtract(expenseTotal);
        BigDecimal avgInc = incomeTxns > 0 ? incomeTotal.divide(BigDecimal.valueOf(incomeTxns), 2, java.math.RoundingMode.HALF_UP) : BigDecimal.ZERO;
        BigDecimal avgExp = expenseTxns > 0 ? expenseTotal.divide(BigDecimal.valueOf(expenseTxns), 2, java.math.RoundingMode.HALF_UP) : BigDecimal.ZERO;

        return FinancialReportResponse.builder()
                .type(t)
                .groupBy(gb)
                .fromDate(f)
                .toDate(to2)
                .category(cat)
                .buckets(buckets)
                .totalIncome(incomeTotal)
                .totalExpense(expenseTotal)
                .netCash(net)
                .incomeTxns(incomeTxns)
                .expenseTxns(expenseTxns)
                .avgIncomePerTxn(avgInc)
                .avgExpensePerTxn(avgExp)
                .categoryBreakdown(catRows)
                .build();
    }

    /** Distinct income categories present in a range — powers the Income category filter. */
    public List<String> getIncomeCategories(LocalDate from, LocalDate to) {
        LocalDate today = LocalDate.now();
        LocalDate f = from != null ? from : today.minusYears(1);
        LocalDate t = to != null ? to : today;
        return paymentRepo.distinctIncomeCategories(f, t);
    }

    private String normaliseFinType(String type) {
        if (type == null) return "NETCASH";
        return switch (type.trim().toUpperCase()) {
            case "INCOME" -> "INCOME";
            case "EXPENSE" -> "EXPENSE";
            default -> "NETCASH";
        };
    }

    private BigDecimal dec(Object o) {
        if (o == null) return BigDecimal.ZERO;
        if (o instanceof BigDecimal b) return b;
        return BigDecimal.valueOf(((Number) o).doubleValue());
    }

    private String normaliseGroupBy(String g) {
        if (g == null) return "DAY";
        return switch (g.trim().toUpperCase()) {
            case "MONTH" -> "MONTH";
            case "YEAR"  -> "YEAR";
            default      -> "DAY";
        };
    }

    private String bucketKey(LocalDate d, String gb) {
        return switch (gb) {
            case "MONTH" -> String.format("%04d-%02d", d.getYear(), d.getMonthValue());
            case "YEAR"  -> String.format("%04d", d.getYear());
            default      -> d.toString();
        };
    }

    private LocalDate bucketStart(String key, String gb) {
        return switch (gb) {
            case "MONTH" -> {
                String[] p = key.split("-");
                yield LocalDate.of(Integer.parseInt(p[0]), Integer.parseInt(p[1]), 1);
            }
            case "YEAR"  -> LocalDate.of(Integer.parseInt(key), 1, 1);
            default      -> LocalDate.parse(key);
        };
    }

    private String bucketLabel(LocalDate d, String gb) {
        return switch (gb) {
            case "MONTH" -> MONTH_LABELS[d.getMonthValue()] + " " + d.getYear();
            case "YEAR"  -> String.valueOf(d.getYear());
            default      -> String.format("%02d %s %d", d.getDayOfMonth(), MONTH_LABELS[d.getMonthValue()], d.getYear());
        };
    }

    private long num(Object o) { return o == null ? 0L : ((Number) o).longValue(); }

    // ── helpers ─────────────────────────────────────────────────────────────

    private String normalisePeriod(String periodType) {
        if (periodType == null) return "DAY";
        return switch (periodType.trim().toUpperCase()) {
            case "MONTH" -> "MONTH";
            case "YEAR" -> "YEAR";
            default -> "DAY";
        };
    }

    private BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private boolean toBoolean(Object o) {
        if (o instanceof Boolean b) return b;
        if (o instanceof Number n) return n.intValue() != 0;
        return Boolean.parseBoolean(String.valueOf(o));
    }
}
