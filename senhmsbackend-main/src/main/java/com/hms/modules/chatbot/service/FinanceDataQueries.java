package com.hms.modules.chatbot.service;

import com.hms.modules.chatbot.dto.DataAnswer;
import com.hms.modules.chatbot.enums.DataTool;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.hms.modules.chatbot.service.AnswerBuilder.*;

/**
 * Read-only aggregate queries for revenue, expenses and insurance.
 * "Revenue" follows the dashboard: bills paid + insurance settled + manual daily-summary entries.
 */
@Component
@RequiredArgsConstructor
class FinanceDataQueries {

    private static final String BILL_OK = "status NOT IN ('CANCELLED','CONSOLIDATED')";

    private final JdbcTemplate jdbc;

    DataAnswer revenueToday(LocalDate today) {
        Map<String, Object> r = jdbc.queryForMap(
                "SELECT COALESCE(SUM(paid_amount), 0) AS paid, COUNT(*) AS bills FROM bills WHERE `date` = ? AND " + BILL_OK, today);
        return table(DataTool.REVENUE_TODAY, "Collected today (bills)", List.of("Metric", "Value"), List.of(
                List.of("Amount collected", money(r.get("paid"))),
                List.of("Bills raised", num(r.get("bills")))));
    }

    DataAnswer revenueMonth(LocalDate today) {
        LocalDate from = today.withDayOfMonth(1);
        Map<String, Object> r = jdbc.queryForMap("""
                SELECT b.v AS bills, i.v AS insurance, m.v AS manual_amt, b.v + i.v + m.v AS total
                FROM (SELECT COALESCE(SUM(paid_amount), 0) v FROM bills WHERE `date` BETWEEN ? AND ? AND %s) b,
                     (SELECT COALESCE(SUM(settled_amount), 0) v FROM insurance_claims WHERE settled_date BETWEEN ? AND ?) i,
                     (SELECT COALESCE(SUM(amount), 0) v FROM daily_summary_entries WHERE entry_date BETWEEN ? AND ?) m
                """.formatted(BILL_OK), from, today, from, today, from, today);
        return table(DataTool.REVENUE_MONTH, "Revenue this month", List.of("Source", "Amount"), List.of(
                List.of("Bills collected", money(r.get("bills"))),
                List.of("Insurance settled", money(r.get("insurance"))),
                List.of("Manual cash entries", money(r.get("manual_amt"))),
                List.of("Total revenue", money(r.get("total")))));
    }

    DataAnswer monthlyRevenueYear(LocalDate today) {
        int y = today.getYear();
        List<Map<String, Object>> rs = jdbc.queryForList("""
                SELECT t.mo, t.bill_amt, t.ins_amt, t.manual_amt, t.bill_amt + t.ins_amt + t.manual_amt AS total
                FROM (SELECT m.mo,
                        (SELECT COALESCE(SUM(paid_amount), 0) FROM bills
                          WHERE YEAR(`date`) = ? AND MONTH(`date`) = m.mo AND %s) AS bill_amt,
                        (SELECT COALESCE(SUM(settled_amount), 0) FROM insurance_claims
                          WHERE YEAR(settled_date) = ? AND MONTH(settled_date) = m.mo) AS ins_amt,
                        (SELECT COALESCE(SUM(amount), 0) FROM daily_summary_entries
                          WHERE YEAR(entry_date) = ? AND MONTH(entry_date) = m.mo) AS manual_amt
                      FROM (SELECT 1 mo UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5
                            UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
                            UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12) m) t
                ORDER BY t.mo""".formatted(BILL_OK), y, y, y);
        String[] names = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
        List<List<String>> rows = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        List<Double> totals = new ArrayList<>();
        for (Map<String, Object> r : rs) {
            String name = names[((Number) r.get("mo")).intValue() - 1];
            rows.add(List.of(name, money(r.get("bill_amt")), money(r.get("ins_amt")), money(r.get("manual_amt")), money(r.get("total"))));
            labels.add(name);
            totals.add(dbl(r.get("total")));
        }
        return chart(table(DataTool.MONTHLY_REVENUE_YEAR, "Monthly revenue " + y,
                List.of("Month", "Bills", "Insurance", "Manual", "Total"), rows), "bar", labels, series("Revenue (₹)", totals));
    }

    DataAnswer paymentModeSplit(LocalDate today) {
        List<Map<String, Object>> rs = jdbc.queryForList("""
                SELECT COALESCE(payment_mode, 'Unspecified') AS label, COALESCE(SUM(paid_amount), 0) AS amt
                FROM bills WHERE `date` BETWEEN ? AND ? AND %s
                GROUP BY COALESCE(payment_mode, 'Unspecified') ORDER BY amt DESC""".formatted(BILL_OK), today.withDayOfMonth(1), today);
        return amountByLabel(DataTool.PAYMENT_MODE_SPLIT, "Collection by payment mode (this month)", "Payment mode", rs, "pie");
    }

    DataAnswer pendingDues() {
        Map<String, Object> r = jdbc.queryForMap(
                "SELECT COUNT(*) AS bills, COALESCE(SUM(due_amount), 0) AS due FROM bills WHERE status IN ('PENDING','PARTIAL')");
        return table(DataTool.PENDING_DUES, "Pending dues", List.of("Metric", "Value"), List.of(
                List.of("Bills with dues", num(r.get("bills"))),
                List.of("Total outstanding", money(r.get("due")))));
    }

    DataAnswer expensesMonth(LocalDate today) {
        Map<String, Object> r = jdbc.queryForMap("""
                SELECT COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS total FROM expenses
                WHERE `date` BETWEEN ? AND ? AND status <> 'REJECTED'""", today.withDayOfMonth(1), today);
        return table(DataTool.EXPENSES_MONTH, "Expenses this month (excluding rejected)", List.of("Metric", "Value"), List.of(
                List.of("Expense entries", num(r.get("cnt"))),
                List.of("Total expenses", money(r.get("total")))));
    }

    DataAnswer expensesByCategory(LocalDate today) {
        List<Map<String, Object>> rs = jdbc.queryForList("""
                SELECT COALESCE(category, 'Uncategorised') AS label, COALESCE(SUM(amount), 0) AS amt
                FROM expenses WHERE `date` BETWEEN ? AND ? AND status <> 'REJECTED'
                GROUP BY COALESCE(category, 'Uncategorised') ORDER BY amt DESC LIMIT 10""", today.withDayOfMonth(1), today);
        return amountByLabel(DataTool.EXPENSES_BY_CATEGORY, "Expenses by category (this month)", "Category", rs, "pie");
    }

    DataAnswer netCashMonth(LocalDate today) {
        LocalDate from = today.withDayOfMonth(1);
        Map<String, Object> r = jdbc.queryForMap("""
                SELECT rev.v AS revenue, ex.v AS expenses, rev.v - ex.v AS net
                FROM (SELECT (SELECT COALESCE(SUM(paid_amount), 0) FROM bills WHERE `date` BETWEEN ? AND ? AND %s)
                           + (SELECT COALESCE(SUM(settled_amount), 0) FROM insurance_claims WHERE settled_date BETWEEN ? AND ?)
                           + (SELECT COALESCE(SUM(amount), 0) FROM daily_summary_entries WHERE entry_date BETWEEN ? AND ?) AS v) rev,
                     (SELECT COALESCE(SUM(amount), 0) AS v FROM expenses WHERE `date` BETWEEN ? AND ? AND status <> 'REJECTED') ex
                """.formatted(BILL_OK), from, today, from, today, from, today, from, today);
        return table(DataTool.NET_CASH_MONTH, "Net cash this month", List.of("Metric", "Amount"), List.of(
                List.of("Revenue", money(r.get("revenue"))),
                List.of("Expenses", money(r.get("expenses"))),
                List.of("Net cash", money(r.get("net")))));
    }

    DataAnswer pendingClaims() {
        Map<String, Object> r = jdbc.queryForMap("""
                SELECT COUNT(*) AS cnt, COALESCE(SUM(claimed_amount), 0) AS amt FROM insurance_claims
                WHERE status IN ('SENT_FOR_APPROVAL','APPROVED','CLAIMED')""");
        return table(DataTool.PENDING_CLAIMS, "Pending insurance claims", List.of("Metric", "Value"), List.of(
                List.of("Pending claims", num(r.get("cnt"))),
                List.of("Claimed amount pending", money(r.get("amt")))));
    }

    DataAnswer claimsByStatus() {
        List<Map<String, Object>> rs = jdbc.queryForList("""
                SELECT status AS label, COUNT(*) AS cnt, COALESCE(SUM(claimed_amount), 0) AS amt
                FROM insurance_claims GROUP BY status ORDER BY cnt DESC""");
        List<List<String>> rows = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        List<Double> counts = new ArrayList<>();
        for (Map<String, Object> r : rs) {
            rows.add(List.of(String.valueOf(r.get("label")), num(r.get("cnt")), money(r.get("amt"))));
            labels.add(String.valueOf(r.get("label")));
            counts.add(dbl(r.get("cnt")));
        }
        DataAnswer a = table(DataTool.CLAIMS_BY_STATUS, "Insurance claims by status", List.of("Status", "Claims", "Claimed amount"), rows);
        return rows.isEmpty() ? a : chart(a, "bar", labels, series("Claims", counts));
    }

    // ── shared ───────────────────────────────────────────────────────────────

    private DataAnswer amountByLabel(DataTool tool, String title, String labelColumn, List<Map<String, Object>> rs, String chartType) {
        List<List<String>> rows = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        List<Double> values = new ArrayList<>();
        for (Map<String, Object> r : rs) {
            rows.add(List.of(String.valueOf(r.get("label")), money(r.get("amt"))));
            labels.add(String.valueOf(r.get("label")));
            values.add(dbl(r.get("amt")));
        }
        DataAnswer a = table(tool, title, List.of(labelColumn, "Amount"), rows);
        return rows.isEmpty() ? a : chart(a, chartType, labels, series("Amount (₹)", values));
    }
}
