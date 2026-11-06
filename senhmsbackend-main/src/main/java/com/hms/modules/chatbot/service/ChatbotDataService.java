package com.hms.modules.chatbot.service;

import com.hms.modules.chatbot.client.ChatbotAiClient;
import com.hms.modules.chatbot.dto.DataAnswer;
import com.hms.modules.chatbot.dto.StaticQuestion;
import com.hms.modules.chatbot.enums.DataTool;
import com.hms.modules.prescription.exception.OpenAiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class ChatbotDataService {

    static final int MAX_QUESTION_CHARS = 300;
    static final int MAX_ROWS = 50;

    private final DataToolExecutor executor;
    private final ChatbotAiClient ai;

    public List<StaticQuestion> questionsFor(Set<String> roles) {
        return allowedTools(roles).stream().map(t -> {
            StaticQuestion q = new StaticQuestion();
            q.setId(t.name());
            q.setText(t.getQuestion());
            q.setCategory(t.getCategory().name());
            return q;
        }).toList();
    }

    public DataAnswer ask(String question, Set<String> roles) {
        if (question == null || question.isBlank()) throw new IllegalArgumentException("Question is required");
        if (question.length() > MAX_QUESTION_CHARS) throw new IllegalArgumentException("Question is too long");

        DataTool tool = matchStatic(question).orElse(null);
        if (tool == null) {
            List<DataTool> candidates = allowedTools(roles);
            if (candidates.isEmpty()) return unsupported(candidates);
            Optional<String> picked = ai.pickTool(question.trim(), candidates);
            tool = picked.flatMap(ChatbotDataService::toolById).orElse(null);
            if (tool == null) return unsupported(candidates);
        }
        if (!tool.getRoles().stream().anyMatch(roles::contains)) {
            throw new AccessDeniedException("You do not have access to this data");
        }

        DataAnswer data = executor.execute(tool);
        data.setToolId(tool.name());
        if (data.getTitle() == null) data.setTitle(tool.getQuestion());
        if (data.getRows().size() > MAX_ROWS) data.setRows(List.copyOf(data.getRows().subList(0, MAX_ROWS)));
        try {
            data.setAnswer(ai.summarize(question.trim(), data));
        } catch (OpenAiException ex) {
            log.warn("[CHATBOT] summary unavailable, using fallback text: {}", ex.getMessage());
            data.setAnswer(fallbackAnswer(data));
        }
        log.info("[CHATBOT] data tool={} rows={}", tool, data.getRows().size());
        return data;
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private static List<DataTool> allowedTools(Set<String> roles) {
        return Arrays.stream(DataTool.values())
                .filter(t -> t.getRoles().stream().anyMatch(roles::contains)).toList();
    }

    private static Optional<DataTool> matchStatic(String question) {
        String n = normalize(question);
        return Arrays.stream(DataTool.values()).filter(t -> normalize(t.getQuestion()).equals(n)).findFirst();
    }

    private static Optional<DataTool> toolById(String id) {
        return Arrays.stream(DataTool.values()).filter(t -> t.name().equals(id)).findFirst();
    }

    private static String normalize(String s) {
        return s.trim().toLowerCase().replaceAll("\\s+", " ").replaceAll("\\?+$", "").trim();
    }

    private static DataAnswer unsupported(List<DataTool> candidates) {
        DataAnswer a = new DataAnswer();
        a.setAnswer("I can answer questions about patients, revenue, expenses, insurance, lab and beds. Try one of these:");
        a.setSuggestions(candidates.stream().limit(4).map(DataTool::getQuestion).toList());
        return a;
    }

    private static String fallbackAnswer(DataAnswer d) {
        if (d.getRows().isEmpty()) return d.getTitle() + ": no data found.";
        StringBuilder sb = new StringBuilder(d.getTitle()).append(": ");
        int n = Math.min(3, d.getRows().size());
        for (int i = 0; i < n; i++) {
            List<String> row = d.getRows().get(i);
            sb.append(String.join(" — ", row));
            if (i < n - 1) sb.append("; ");
        }
        return sb.toString();
    }
}
