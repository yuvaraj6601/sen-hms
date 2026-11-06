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

/** Read-only aggregate queries for patients, lab and beds. All counting/grouping happens in MySQL. */
@Component
@RequiredArgsConstructor
class PatientDataQueries {

    private final JdbcTemplate jdbc;

    DataAnswer opToday(LocalDate today) {
        Map<String, Object> r = jdbc.queryForMap("""
                SELECT COUNT(*) AS total,
                       COALESCE(SUM(type = 'NEW'), 0) AS new_cnt,
                       COALESCE(SUM(type IN ('FOLLOW_UP','REVIEW')), 0) AS follow_cnt,
                       COALESCE(SUM(`free` = 1), 0) AS free_cnt
                FROM op_visits WHERE visit_date = ?""", today);
        return table(DataTool.OP_TODAY, "OP patients today", List.of("Metric", "Value"), List.of(
                List.of("Total OP visits", num(r.get("total"))),
                List.of("New patients", num(r.get("new_cnt"))),
                List.of("Follow-up / review", num(r.get("follow_cnt"))),
                List.of("Free patients", num(r.get("free_cnt")))));
    }

    DataAnswer opVsIp7d(LocalDate today) {
        List<Map<String, Object>> rs = jdbc.queryForList("""
                SELECT d.day AS day,
                       (SELECT COUNT(*) FROM op_visits o WHERE o.visit_date = d.day) AS op_cnt,
                       (SELECT COUNT(*) FROM admissions a WHERE a.admission_date = d.day) AS ip_cnt
                FROM (SELECT DATE_SUB(CAST(? AS DATE), INTERVAL n DAY) AS day
                      FROM (SELECT 0 n UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3
                            UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6) s) d
                ORDER BY d.day""", today);
        List<List<String>> rows = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        List<Double> op = new ArrayList<>();
        List<Double> ip = new ArrayList<>();
        for (Map<String, Object> r : rs) {
            rows.add(List.of(day(r.get("day")), num(r.get("op_cnt")), num(r.get("ip_cnt"))));
            labels.add(day(r.get("day")).substring(0, 6));
            op.add(dbl(r.get("op_cnt")));
            ip.add(dbl(r.get("ip_cnt")));
        }
        String title = "OP vs IP patients (" + day(rs.get(0).get("day")) + " to " + day(rs.get(rs.size() - 1).get("day")) + ")";
        Map<String, List<Double>> series = new LinkedHashMap<>();
        series.put("OP", op);
        series.put("IP", ip);
        return chart(table(DataTool.OP_VS_IP_7D, title, List.of("Date", "OP", "IP"), rows), "bar", labels, series);
    }

    DataAnswer currentInpatients() {
        Map<String, Object> r = jdbc.queryForMap("""
                SELECT COUNT(*) AS total,
                       COALESCE(SUM(surgical = 1), 0) AS surgical_cnt,
                       COALESCE(SUM(mlc = 1), 0) AS mlc_cnt,
                       COALESCE(SUM(is_insurance = 1), 0) AS ins_cnt
                FROM admissions WHERE status <> 'DISCHARGED'""");
        return table(DataTool.CURRENT_INPATIENTS, "Currently admitted patients", List.of("Metric", "Value"), List.of(
                List.of("Currently admitted", num(r.get("total"))),
                List.of("Surgical cases", num(r.get("surgical_cnt"))),
                List.of("MLC cases", num(r.get("mlc_cnt"))),
                List.of("Insurance patients", num(r.get("ins_cnt")))));
    }

    DataAnswer admissionsDischargesToday(LocalDate today) {
        Map<String, Object> r = jdbc.queryForMap("""
                SELECT (SELECT COUNT(*) FROM admissions WHERE admission_date = ?) AS adm,
                       (SELECT COUNT(*) FROM admissions WHERE discharge_date = ?) AS dis""", today, today);
        return table(DataTool.ADMISSIONS_DISCHARGES_TODAY, "Admissions and discharges today", List.of("Metric", "Value"), List.of(
                List.of("Admissions today", num(r.get("adm"))),
                List.of("Discharges today", num(r.get("dis")))));
    }

    DataAnswer avgLengthOfStay(LocalDate today) {
        Map<String, Object> r = jdbc.queryForMap("""
                SELECT COUNT(*) AS discharged, ROUND(AVG(total_days_stayed), 1) AS avg_days
                FROM admissions WHERE status = 'DISCHARGED' AND discharge_date >= ?""", today.minusDays(29));
        return table(DataTool.AVG_LENGTH_OF_STAY, "Average length of stay (last 30 days)", List.of("Metric", "Value"), List.of(
                List.of("Patients discharged", num(r.get("discharged"))),
                List.of("Average stay (days)", r.get("avg_days") == null ? "-" : num(r.get("avg_days")))));
    }

    DataAnswer topDoctors(LocalDate today) {
        return groupedCount(DataTool.TOP_DOCTORS_VISITS, "OP visits by doctor (this month)", "Doctor", """
                SELECT COALESCE(doctor_name, 'Unassigned') AS label, COUNT(*) AS cnt
                FROM op_visits WHERE visit_date BETWEEN ? AND ?
                GROUP BY COALESCE(doctor_name, 'Unassigned') ORDER BY cnt DESC LIMIT 10""", today.withDayOfMonth(1), today);
    }

    DataAnswer departmentVisits(LocalDate today) {
        return groupedCount(DataTool.DEPARTMENT_VISITS, "OP visits by department (this month)", "Department", """
                SELECT COALESCE(department, 'Unassigned') AS label, COUNT(*) AS cnt
                FROM op_visits WHERE visit_date BETWEEN ? AND ?
                GROUP BY COALESCE(department, 'Unassigned') ORDER BY cnt DESC LIMIT 10""", today.withDayOfMonth(1), today);
    }

    DataAnswer labPending() {
        return groupedCount(DataTool.LAB_PENDING, "Pending lab orders by status", "Status", """
                SELECT status AS label, COUNT(*) AS cnt FROM lab_investigations
                WHERE status NOT IN ('COMPLETED','CANCELLED') GROUP BY status ORDER BY cnt DESC""");
    }

    DataAnswer topLabTests(LocalDate today) {
        return groupedCount(DataTool.TOP_LAB_TESTS, "Most ordered lab tests (this month)", "Test", """
                SELECT investigation_name AS label, COUNT(*) AS cnt FROM lab_investigations
                WHERE ordered_date BETWEEN ? AND ? GROUP BY investigation_name ORDER BY cnt DESC LIMIT 10""",
                today.withDayOfMonth(1), today);
    }

    DataAnswer bedOccupancy() {
        List<Map<String, Object>> rs = jdbc.queryForList("""
                SELECT w.name AS ward, COUNT(b.id) AS total, COALESCE(SUM(b.status = 'OCCUPIED'), 0) AS occupied,
                       ROUND(100 * COALESCE(SUM(b.status = 'OCCUPIED'), 0) / NULLIF(COUNT(b.id), 0), 1) AS pct
                FROM wards w LEFT JOIN beds b ON b.ward_id = w.id
                GROUP BY w.id, w.name ORDER BY w.name""");
        List<List<String>> rows = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        List<Double> occ = new ArrayList<>();
        List<Double> free = new ArrayList<>();
        for (Map<String, Object> r : rs) {
            rows.add(List.of(String.valueOf(r.get("ward")), num(r.get("occupied")), num(r.get("total")),
                    r.get("pct") == null ? "-" : num(r.get("pct")) + "%"));
            labels.add(String.valueOf(r.get("ward")));
            occ.add(dbl(r.get("occupied")));
            free.add(dbl(r.get("total")) - dbl(r.get("occupied")));
        }
        Map<String, List<Double>> series = new LinkedHashMap<>();
        series.put("Occupied", occ);
        series.put("Available", free);
        return chart(table(DataTool.BED_OCCUPANCY, "Bed occupancy by ward", List.of("Ward", "Occupied", "Total beds", "Occupancy"), rows),
                "bar", labels, series);
    }

    // ── shared ───────────────────────────────────────────────────────────────

    private DataAnswer groupedCount(DataTool tool, String title, String labelColumn, String sql, Object... args) {
        List<Map<String, Object>> rs = jdbc.queryForList(sql, args);
        List<List<String>> rows = new ArrayList<>();
        List<String> labels = new ArrayList<>();
        List<Double> values = new ArrayList<>();
        for (Map<String, Object> r : rs) {
            rows.add(List.of(String.valueOf(r.get("label")), num(r.get("cnt"))));
            labels.add(String.valueOf(r.get("label")));
            values.add(dbl(r.get("cnt")));
        }
        DataAnswer a = table(tool, title, List.of(labelColumn, "Count"), rows);
        return rows.isEmpty() ? a : chart(a, "bar", labels, series("Count", values));
    }
}
