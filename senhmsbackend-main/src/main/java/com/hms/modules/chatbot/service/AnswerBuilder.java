package com.hms.modules.chatbot.service;

import com.hms.modules.chatbot.dto.DataAnswer;
import com.hms.modules.chatbot.enums.DataTool;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Small helpers shared by the data-query classes: build tables / charts and format values. */
final class AnswerBuilder {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH);

    private AnswerBuilder() {
    }

    static DataAnswer table(DataTool tool, String title, List<String> columns, List<List<String>> rows) {
        DataAnswer a = new DataAnswer();
        a.setToolId(tool.name());
        a.setTitle(title);
        a.setColumns(columns);
        a.setRows(rows);
        return a;
    }

    static DataAnswer chart(DataAnswer a, String type, List<String> labels, Map<String, List<Double>> series) {
        DataAnswer.ChartData c = new DataAnswer.ChartData();
        c.setType(type);
        c.setLabels(labels);
        List<DataAnswer.Series> out = new ArrayList<>();
        for (Map.Entry<String, List<Double>> e : series.entrySet()) {
            DataAnswer.Series s = new DataAnswer.Series();
            s.setLabel(e.getKey());
            s.setValues(e.getValue());
            out.add(s);
        }
        c.setSeries(out);
        a.setChart(c);
        return a;
    }

    static Map<String, List<Double>> series(String label, List<Double> values) {
        Map<String, List<Double>> m = new LinkedHashMap<>();
        m.put(label, values);
        return m;
    }

    static String money(Object v) {
        BigDecimal b = v == null ? BigDecimal.ZERO : new BigDecimal(v.toString());
        return NumberFormat.getCurrencyInstance(new Locale("en", "IN")).format(b);
    }

    static String num(Object v) {
        if (v == null) return "0";
        BigDecimal b = new BigDecimal(v.toString()).stripTrailingZeros();
        return b.scale() < 0 ? b.setScale(0).toPlainString() : b.toPlainString();
    }

    static double dbl(Object v) {
        return v == null ? 0.0 : new BigDecimal(v.toString()).doubleValue();
    }

    static String day(Object sqlDate) {
        return sqlDate == null ? "" : LocalDate.parse(sqlDate.toString().substring(0, 10)).format(DAY);
    }
}
