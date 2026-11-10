package com.hms.modules.reports.service;

import com.hms.masters.entity.Bed;
import com.hms.masters.enums.Status;
import com.hms.modules.insurance.enums.ClaimStatus;
import com.hms.modules.reports.dto.AnalyticsReportResponse;
import com.hms.modules.reports.dto.AnalyticsReportResponse.Series;
import com.hms.modules.reports.dto.AnalyticsReportResponse.Slice;
import com.hms.modules.reports.dto.AnalyticsReportResponse.Stat;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;

/**
 * Analytics reports for the Reports menu — plain aggregation queries (no AI):
 * DEPARTMENT_PATIENTS, DOCTOR_OP, DISCHARGE, INSURANCE_CLAIMS, BED_OCCUPANCY,
 * LAB_STATUS, PAYMENT_ANALYSIS. Each returns the generic table + chart payload.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AnalyticsReportService {

    @PersistenceContext
    private EntityManager em;

    private final ReportsService base; // shared DAY/MONTH/YEAR bucketing helpers

    public AnalyticsReportResponse generate(String type, LocalDate from, LocalDate to, String groupBy) {
        LocalDate today = LocalDate.now();
        LocalDate f = from != null ? from : today;
        LocalDate t = to != null ? to : today;
        if (t.isBefore(f)) { LocalDate tmp = f; f = t; t = tmp; }
        String gb = base.normaliseGroupBy(groupBy);
        String ty = type == null ? "" : type.trim().toUpperCase();
        return switch (ty) {
            case "DEPARTMENT_PATIENTS" -> departmentPatients(f, t);
            case "DOCTOR_OP" -> doctorOp(f, t);
            case "DISCHARGE" -> discharge(f, t, gb);
            case "INSURANCE_CLAIMS" -> insuranceClaims(f, t);
            case "BED_OCCUPANCY" -> bedOccupancy(today);
            case "LAB_STATUS" -> labStatus(f, t);
            case "PAYMENT_ANALYSIS" -> paymentAnalysis(f, t);
            default -> throw new IllegalArgumentException("Unknown report type: " + type);
        };
    }

    // ── Department-wise patients ──────────────────────────────────────────────
    private AnalyticsReportResponse departmentPatients(LocalDate f, LocalDate t) {
        Map<String, long[]> m = new LinkedHashMap<>(); // dept -> [op, ip]
        for (Object[] r : q("""
                SELECT COALESCE(NULLIF(v.department, ''), 'Unassigned'), COUNT(v)
                FROM OPVisit v WHERE v.visitDate BETWEEN :f AND :t
                GROUP BY COALESCE(NULLIF(v.department, ''), 'Unassigned')""", f, t)) {
            m.computeIfAbsent(String.valueOf(r[0]), k -> new long[2])[0] = base.num(r[1]);
        }
        for (Object[] r : q("""
                SELECT COALESCE(NULLIF(a.department, ''), 'Unassigned'), COUNT(a)
                FROM Admission a WHERE a.admissionDate BETWEEN :f AND :t
                GROUP BY COALESCE(NULLIF(a.department, ''), 'Unassigned')""", f, t)) {
            m.computeIfAbsent(String.valueOf(r[0]), k -> new long[2])[1] = base.num(r[1]);
        }
        List<Map.Entry<String, long[]>> list = new ArrayList<>(m.entrySet());
        list.sort(Comparator.comparingLong((Map.Entry<String, long[]> e) -> e.getValue()[0] + e.getValue()[1]).reversed());

        List<List<Object>> rows = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        List<Double> op = new ArrayList<>(), ip = new ArrayList<>();
        List<Slice> pie = new ArrayList<>();
        long sOp = 0, sIp = 0;
        for (var e : list) {
            long o = e.getValue()[0], i = e.getValue()[1];
            rows.add(row(e.getKey(), o, i, o + i));
            labels.add(e.getKey()); op.add((double) o); ip.add((double) i);
            pie.add(new Slice(e.getKey(), o + i));
            sOp += o; sIp += i;
        }
        if (!rows.isEmpty()) rows.add(row("Total", sOp, sIp, sOp + sIp));
        return AnalyticsReportResponse.builder()
                .type("DEPARTMENT_PATIENTS").title("Department-wise Patients").fromDate(f).toDate(t)
                .note("OP = visits by visit date; IP = admissions by admission date")
                .headers(List.of("Department", "OP Patients", "IP Patients", "Total"))
                .rows(rows).hasTotalRow(!rows.isEmpty()).moneyColumns(List.of())
                .summary(List.of(new Stat("Departments", String.valueOf(list.size())),
                        new Stat("OP Patients", String.valueOf(sOp)), new Stat("IP Patients", String.valueOf(sIp))))
                .chartLabels(labels).chartSeries(List.of(new Series("OP", op), new Series("IP", ip)))
                .pie(pie).build();
    }

    // ── Doctor-wise OP visits ─────────────────────────────────────────────────
    private AnalyticsReportResponse doctorOp(LocalDate f, LocalDate t) {
        List<List<Object>> rows = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        List<Double> paidV = new ArrayList<>(), freeV = new ArrayList<>();
        List<Slice> pie = new ArrayList<>();
        long sTotal = 0, sFree = 0;
        for (Object[] r : q("""
                SELECT COALESCE(NULLIF(v.doctorName, ''), 'Unassigned'),
                       COALESCE(NULLIF(v.department, ''), '-'),
                       COUNT(v), SUM(CASE WHEN v.free = true THEN 1 ELSE 0 END)
                FROM OPVisit v WHERE v.visitDate BETWEEN :f AND :t
                GROUP BY COALESCE(NULLIF(v.doctorName, ''), 'Unassigned'), COALESCE(NULLIF(v.department, ''), '-')
                ORDER BY COUNT(v) DESC""", f, t)) {
            long total = base.num(r[2]), free = base.num(r[3]);
            rows.add(row(r[0], r[1], total, free, Math.max(0, total - free)));
            labels.add(String.valueOf(r[0]));
            paidV.add((double) Math.max(0, total - free)); freeV.add((double) free);
            pie.add(new Slice(String.valueOf(r[0]), total));
            sTotal += total; sFree += free;
        }
        if (!rows.isEmpty()) rows.add(row("Total", "", sTotal, sFree, sTotal - sFree));
        return AnalyticsReportResponse.builder()
                .type("DOCTOR_OP").title("Doctor-wise OP Visits").fromDate(f).toDate(t)
                .note("OP visits by visit date, grouped by consulting doctor")
                .headers(List.of("Doctor", "Department", "Total Visits", "Free", "Paid"))
                .rows(rows).hasTotalRow(!rows.isEmpty()).moneyColumns(List.of())
                .summary(List.of(new Stat("Doctors", String.valueOf(labels.size())),
                        new Stat("Total Visits", String.valueOf(sTotal)), new Stat("Free Visits", String.valueOf(sFree))))
                .chartLabels(labels).chartSeries(List.of(new Series("Paid", paidV), new Series("Free", freeV)))
                .pie(pie).build();
    }

    // ── Discharge trends ──────────────────────────────────────────────────────
    private AnalyticsReportResponse discharge(LocalDate f, LocalDate t, String gb) {
        Map<LocalDate, double[]> daily = new TreeMap<>(); // date -> [count, losDaysSum]
        Map<String, Long> byType = new LinkedHashMap<>();
        long total = 0; double losSum = 0;
        for (Object[] r : q("""
                SELECT a.dischargeDate, a.admissionDate, a.dischargeType
                FROM Admission a
                WHERE a.dischargeDate BETWEEN :f AND :t AND a.status = 'DISCHARGED'""", f, t)) {
            LocalDate dd = (LocalDate) r[0], ad = (LocalDate) r[1];
            double los = ad != null ? Math.max(0, ChronoUnit.DAYS.between(ad, dd)) : 0;
            double[] d = daily.computeIfAbsent(dd, k -> new double[2]);
            d[0] += 1; d[1] += los;
            total++; losSum += los;
            byType.merge(r[2] == null ? "Unspecified" : String.valueOf(r[2]), 1L, Long::sum);
        }
        Map<String, double[]> buckets = new LinkedHashMap<>();
        Map<String, String> labelOf = new LinkedHashMap<>();
        for (LocalDate d = f; !d.isAfter(t); d = d.plusDays(1)) {
            String key = base.bucketKey(d, gb);
            buckets.computeIfAbsent(key, k -> new double[2]);
            labelOf.computeIfAbsent(key, k -> base.bucketLabel(base.bucketStart(k, gb), gb));
            double[] src = daily.get(d);
            if (src != null) { buckets.get(key)[0] += src[0]; buckets.get(key)[1] += src[1]; }
        }
        List<List<Object>> rows = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        List<Double> counts = new ArrayList<>();
        buckets.forEach((k, v) -> {
            rows.add(row(labelOf.get(k), (long) v[0], v[0] > 0 ? round1(v[1] / v[0]) : 0.0));
            labels.add(labelOf.get(k)); counts.add(v[0]);
        });
        double avg = total > 0 ? round1(losSum / total) : 0.0;
        if (total > 0) rows.add(row("Total", total, avg));
        List<Slice> pie = new ArrayList<>();
        byType.forEach((k, v) -> pie.add(new Slice(k, v)));
        return AnalyticsReportResponse.builder()
                .type("DISCHARGE").title("Discharge Trends").fromDate(f).toDate(t).groupBy(gb)
                .note("Discharged admissions by discharge date; stay = discharge date − admission date")
                .headers(List.of(gb.equals("MONTH") ? "Month" : gb.equals("YEAR") ? "Year" : "Date", "Discharges", "Avg Stay (days)"))
                .rows(total > 0 ? rows : new ArrayList<>()).hasTotalRow(total > 0).moneyColumns(List.of())
                .summary(List.of(new Stat("Total Discharges", String.valueOf(total)), new Stat("Avg Stay (days)", String.valueOf(avg))))
                .chartLabels(labels).chartSeries(List.of(new Series("Discharges", counts)))
                .pie(pie).build();
    }

    // ── Insurance claims ──────────────────────────────────────────────────────
    private AnalyticsReportResponse insuranceClaims(LocalDate f, LocalDate t) {
        List<Object[]> data = new ArrayList<>(q("""
                SELECT c.status, COUNT(c), COALESCE(SUM(c.claimedAmount), 0),
                       COALESCE(SUM(c.approvedAmount), 0), COALESCE(SUM(c.settledAmount), 0)
                FROM InsuranceClaim c WHERE c.submittedDate BETWEEN :f AND :t
                GROUP BY c.status""", f, t));
        data.sort(Comparator.comparingInt(r -> ((ClaimStatus) r[0]).ordinal()));
        List<List<Object>> rows = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        List<Double> claimed = new ArrayList<>(), approved = new ArrayList<>(), settled = new ArrayList<>();
        List<Slice> pie = new ArrayList<>();
        long n = 0; BigDecimal sc = BigDecimal.ZERO, sa = BigDecimal.ZERO, ss = BigDecimal.ZERO;
        for (Object[] r : data) {
            String st = pretty(String.valueOf(r[0]));
            long cnt = base.num(r[1]);
            BigDecimal c = base.dec(r[2]), a = base.dec(r[3]), s = base.dec(r[4]);
            rows.add(row(st, cnt, c.doubleValue(), a.doubleValue(), s.doubleValue()));
            labels.add(st); claimed.add(c.doubleValue()); approved.add(a.doubleValue()); settled.add(s.doubleValue());
            pie.add(new Slice(st, cnt));
            n += cnt; sc = sc.add(c); sa = sa.add(a); ss = ss.add(s);
        }
        if (!rows.isEmpty()) rows.add(row("Total", n, sc.doubleValue(), sa.doubleValue(), ss.doubleValue()));
        return AnalyticsReportResponse.builder()
                .type("INSURANCE_CLAIMS").title("Insurance Claims").fromDate(f).toDate(t)
                .note("Claims by submitted date, grouped by claim status (claims not yet submitted are excluded)")
                .headers(List.of("Status", "Claims", "Claimed (₹)", "Approved (₹)", "Settled (₹)"))
                .rows(rows).hasTotalRow(!rows.isEmpty()).moneyColumns(List.of(2, 3, 4))
                .summary(List.of(new Stat("Claims", String.valueOf(n)), new Stat("Claimed", inr(sc)), new Stat("Settled", inr(ss))))
                .chartLabels(labels)
                .chartSeries(List.of(new Series("Claimed", claimed), new Series("Approved", approved), new Series("Settled", settled)))
                .pie(pie).build();
    }

    // ── Bed occupancy (current snapshot) ──────────────────────────────────────
    private AnalyticsReportResponse bedOccupancy(LocalDate today) {
        List<List<Object>> rows = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        List<Double> occV = new ArrayList<>(), availV = new ArrayList<>();
        long sT = 0, sO = 0, sR = 0, sM = 0;
        var query = em.createQuery("""
                SELECT w.name, COALESCE(w.wardType, '-'), COUNT(b),
                       SUM(CASE WHEN b.status = :occ THEN 1 ELSE 0 END),
                       SUM(CASE WHEN b.status = :res THEN 1 ELSE 0 END),
                       SUM(CASE WHEN b.status = :mnt THEN 1 ELSE 0 END)
                FROM Bed b JOIN b.ward w
                WHERE w.status = :active
                GROUP BY w.name, w.wardType ORDER BY w.name""", Object[].class)
                .setParameter("occ", Bed.BedStatus.OCCUPIED)
                .setParameter("res", Bed.BedStatus.RESERVED)
                .setParameter("mnt", Bed.BedStatus.MAINTENANCE)
                .setParameter("active", Status.ACTIVE);
        for (Object[] r : query.getResultList()) {
            long tot = base.num(r[2]), occ = base.num(r[3]), res = base.num(r[4]), mnt = base.num(r[5]);
            long avail = Math.max(0, tot - occ - res - mnt);
            rows.add(row(r[0], r[1], tot, occ, res, mnt, avail, pct(occ, tot)));
            labels.add(String.valueOf(r[0])); occV.add((double) occ); availV.add((double) avail);
            sT += tot; sO += occ; sR += res; sM += mnt;
        }
        long sA = Math.max(0, sT - sO - sR - sM);
        if (!rows.isEmpty()) rows.add(row("Total", "", sT, sO, sR, sM, sA, pct(sO, sT)));
        return AnalyticsReportResponse.builder()
                .type("BED_OCCUPANCY").title("Bed Occupancy").fromDate(today).toDate(today)
                .note("Live snapshot of active wards as of today — date range does not apply")
                .headers(List.of("Ward", "Type", "Total Beds", "Occupied", "Reserved", "Maintenance", "Available", "Occupancy %"))
                .rows(rows).hasTotalRow(!rows.isEmpty()).moneyColumns(List.of())
                .summary(List.of(new Stat("Total Beds", String.valueOf(sT)), new Stat("Occupied", String.valueOf(sO)),
                        new Stat("Occupancy", pct(sO, sT) + "%")))
                .chartLabels(labels).chartSeries(List.of(new Series("Occupied", occV), new Series("Available", availV)))
                .pie(List.of(new Slice("Occupied", sO), new Slice("Available", sA),
                        new Slice("Reserved", sR), new Slice("Maintenance", sM)))
                .build();
    }

    // ── Lab status ────────────────────────────────────────────────────────────
    private AnalyticsReportResponse labStatus(LocalDate f, LocalDate t) {
        List<List<Object>> rows = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        List<Double> counts = new ArrayList<>();
        List<Slice> pie = new ArrayList<>();
        long total = 0, completed = 0;
        for (Object[] r : q("""
                SELECT l.status, COUNT(l), AVG(l.actualTatMinutes)
                FROM LabInvestigation l WHERE l.orderedDate BETWEEN :f AND :t
                GROUP BY l.status ORDER BY l.status""", f, t)) {
            String st = pretty(String.valueOf(r[0]));
            long cnt = base.num(r[1]);
            Object tat = r[2] == null ? "-" : (Object) Math.round(((Number) r[2]).doubleValue());
            rows.add(row(st, cnt, tat));
            labels.add(st); counts.add((double) cnt); pie.add(new Slice(st, cnt));
            total += cnt;
            if ("COMPLETED".equals(String.valueOf(r[0]))) completed = cnt;
        }
        if (!rows.isEmpty()) rows.add(row("Total", total, ""));
        return AnalyticsReportResponse.builder()
                .type("LAB_STATUS").title("Lab Status").fromDate(f).toDate(t)
                .note("Lab investigations by ordered date, grouped by status; TAT is the average for tests that recorded it")
                .headers(List.of("Status", "Tests", "Avg TAT (min)"))
                .rows(rows).hasTotalRow(!rows.isEmpty()).moneyColumns(List.of())
                .summary(List.of(new Stat("Total Tests", String.valueOf(total)), new Stat("Completed", String.valueOf(completed)),
                        new Stat("Not Completed", String.valueOf(total - completed))))
                .chartLabels(labels).chartSeries(List.of(new Series("Tests", counts)))
                .pie(pie).build();
    }

    // ── Expenses & payment analysis ───────────────────────────────────────────
    private AnalyticsReportResponse paymentAnalysis(LocalDate f, LocalDate t) {
        List<List<Object>> rows = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        List<Double> amounts = new ArrayList<>();
        List<Slice> pie = new ArrayList<>();
        List<Object[]> inc = q("""
                SELECT p.paymentMode, COALESCE(SUM(p.amount), 0), COUNT(p)
                FROM PaymentRecord p
                WHERE p.date BETWEEN :f AND :t
                  AND p.bill.status <> com.hms.modules.billing.enums.BillStatus.CANCELLED
                GROUP BY p.paymentMode ORDER BY SUM(p.amount) DESC""", f, t);
        List<Object[]> exp = q("""
                SELECT COALESCE(NULLIF(e.category, ''), 'Uncategorised'), COALESCE(SUM(e.amount), 0), COUNT(e)
                FROM Expense e
                WHERE e.date BETWEEN :f AND :t
                  AND e.status IN (com.hms.modules.expense.enums.ExpenseStatus.APPROVED,
                                   com.hms.modules.expense.enums.ExpenseStatus.PAID)
                GROUP BY COALESCE(NULLIF(e.category, ''), 'Uncategorised') ORDER BY SUM(e.amount) DESC""", f, t);
        BigDecimal sInc = BigDecimal.ZERO, sExp = BigDecimal.ZERO;
        for (Object[] r : inc) sInc = sInc.add(base.dec(r[1]));
        for (Object[] r : exp) sExp = sExp.add(base.dec(r[1]));
        for (Object[] r : inc) {
            BigDecimal a = base.dec(r[1]);
            String head = pretty(String.valueOf(r[0]));
            rows.add(row("Income", head, a.doubleValue(), base.num(r[2]), share(a, sInc)));
            labels.add("Income · " + head); amounts.add(a.doubleValue()); pie.add(new Slice(head, a.doubleValue()));
        }
        for (Object[] r : exp) {
            BigDecimal a = base.dec(r[1]);
            rows.add(row("Expense", String.valueOf(r[0]), a.doubleValue(), base.num(r[2]), share(a, sExp)));
            labels.add("Expense · " + r[0]); amounts.add(a.doubleValue());
        }
        return AnalyticsReportResponse.builder()
                .type("PAYMENT_ANALYSIS").title("Expenses & Payment Analysis").fromDate(f).toDate(t)
                .note("Income received by payment mode (cancelled bills excluded) vs approved/paid expenses by category; share is within its own type")
                .headers(List.of("Type", "Head", "Amount (₹)", "Transactions", "Share %"))
                .rows(rows).hasTotalRow(false).moneyColumns(List.of(2))
                .summary(List.of(new Stat("Income", inr(sInc)), new Stat("Expense", inr(sExp)), new Stat("Net", inr(sInc.subtract(sExp)))))
                .chartLabels(labels).chartSeries(List.of(new Series("Amount", amounts)))
                .pie(pie).build();
    }

    // ── helpers ───────────────────────────────────────────────────────────────
    private List<Object[]> q(String jpql, LocalDate f, LocalDate t) {
        return em.createQuery(jpql, Object[].class).setParameter("f", f).setParameter("t", t).getResultList();
    }

    private static List<Object> row(Object... cells) { return new ArrayList<>(Arrays.asList(cells)); }

    private static double round1(double v) { return Math.round(v * 10.0) / 10.0; }

    private static double pct(long part, long whole) { return whole > 0 ? round1(part * 100.0 / whole) : 0.0; }

    private static double share(BigDecimal part, BigDecimal whole) {
        return whole.signum() > 0 ? round1(part.doubleValue() * 100.0 / whole.doubleValue()) : 0.0;
    }

    private static String pretty(String enumName) {
        String s = enumName.replace('_', ' ').toLowerCase(Locale.ROOT);
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private static String inr(BigDecimal v) {
        return "₹" + NumberFormat.getNumberInstance(new Locale("en", "IN")).format(v.setScale(0, java.math.RoundingMode.HALF_UP));
    }
}
