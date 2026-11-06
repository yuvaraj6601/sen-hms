package com.hms.modules.chatbot.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.modules.chatbot.dto.DataAnswer;
import com.hms.modules.chatbot.dto.DietPlanContent;
import com.hms.modules.chatbot.dto.DietPlanInput;
import com.hms.modules.chatbot.entity.DietRule;
import com.hms.modules.chatbot.enums.DataTool;
import com.hms.modules.prescription.client.OpenAiProperties;
import com.hms.modules.prescription.exception.OpenAiException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Chat-completions client for the chatbot. Never sends patient identity; the key is never logged. */
public class ChatbotOpenAiClient implements ChatbotAiClient {

    private static final int MAX_ROWS_TO_MODEL = 50;

    private static final String SUMMARY_PROMPT = """
            You are a hospital analytics assistant. Answer the user's question in one to three short
            sentences using ONLY the data provided. Include the key numbers. Amounts are in Indian rupees.
            If the data is empty say so plainly. Never invent numbers.
            """;

    private static final String DIET_PROMPT = """
            You are a clinical dietician assistant preparing a ONE-DAY Indian diet plan.
            Reply with ONE JSON object only:
            {"summary": string, "meals": [{"name": string, "time": string, "items": [string]}],
             "avoid": [string], "tips": [string]}
            Rules you MUST follow:
            - Use meals: Early morning, Breakfast, Mid-morning, Lunch, Evening snack, Dinner, Bedtime.
            - Stay close to the target calories (split across meals) and respect the protein cap if given.
            - Every item states a portion (e.g. "1 cup", "2 rotis").
            - Respect the food preference and NEVER include an allergen.
            - NEVER include any food from a rule's forbidden list; prefer its preferred foods;
              honour low-GI, fluid and sodium/potassium/phosphorus limits where stated.
            - "avoid" lists foods to avoid for these conditions; "tips" are short practical advice.
            """;

    private final RestClient http;
    private final OpenAiProperties props;
    private final ObjectMapper mapper = new ObjectMapper();

    public ChatbotOpenAiClient(RestClient.Builder builder, OpenAiProperties props) {
        this.props = props;
        this.http = builder.baseUrl(props.baseUrl()).build();
    }

    @Override
    public Optional<String> pickTool(String question, List<DataTool> candidates) {
        StringBuilder menu = new StringBuilder();
        for (DataTool t : candidates) {
            menu.append(t.name()).append(": ").append(t.getQuestion()).append('\n');
        }
        String system = "Pick the ONE tool that answers the user's question, or null if none clearly fits.\n"
                + "Reply with JSON only: {\"tool\": \"<ID>\"} or {\"tool\": null}.\nTools:\n" + menu;
        JsonNode node = parseJson(chat(system, question));
        JsonNode tool = node.get("tool");
        if (tool == null || tool.isNull() || tool.asText().isBlank() || "null".equalsIgnoreCase(tool.asText())) {
            return Optional.empty();
        }
        return Optional.of(tool.asText().trim());
    }

    @Override
    public String summarize(String question, DataAnswer data) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("question", question);
        payload.put("title", data.getTitle());
        payload.put("columns", data.getColumns());
        List<List<String>> rows = data.getRows();
        payload.put("rows", rows.size() > MAX_ROWS_TO_MODEL ? rows.subList(0, MAX_ROWS_TO_MODEL) : rows);
        try {
            return chat(SUMMARY_PROMPT, mapper.writeValueAsString(payload)).trim();
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new OpenAiException("Could not prepare data for the model", ex);
        }
    }

    @Override
    public DietPlanContent generateDietPlan(DietPlanInput in) {
        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("age", in.getAge());
        profile.put("gender", in.getGender());
        profile.put("heightCm", in.getHeightCm());
        profile.put("weightKg", in.getWeightKg());
        profile.put("conditions", in.getConditions());
        profile.put("activity", in.getActivity());
        profile.put("goal", in.getGoal());
        profile.put("foodPreference", in.getFoodPreference());
        profile.put("allergies", in.getAllergies());
        profile.put("targetCalories", in.getTargetCalories());
        profile.put("proteinCapGrams", in.getProteinCapGrams());
        List<Map<String, Object>> rules = new ArrayList<>();
        for (DietRule r : in.getRules()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("condition", r.getDisplayName());
            m.put("forbiddenFoods", r.getForbiddenFoods());
            m.put("preferredFoods", r.getPreferredFoods());
            m.put("lowGlycemicIndex", r.isLowGi());
            m.put("restrictFluid", r.isRestrictFluid());
            m.put("sodiumMaxMg", r.getSodiumMaxMg());
            m.put("potassiumMaxMg", r.getPotassiumMaxMg());
            m.put("phosphorusMaxMg", r.getPhosphorusMaxMg());
            m.put("satFatMaxPctKcal", r.getSatFatMaxPctKcal());
            m.put("note", r.getClinicalNote());
            rules.add(m);
        }
        profile.put("clinicalRules", rules);
        try {
            String content = chat(DIET_PROMPT, mapper.writeValueAsString(profile));
            DietPlanContent plan = mapper.treeToValue(parseJson(content), DietPlanContent.class);
            if (plan == null) throw new OpenAiException("Model returned an empty plan");
            return plan;
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new OpenAiException("Model returned an unreadable diet plan", ex);
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private String chat(String system, String user) {
        if (props.apiKey() == null || props.apiKey().isBlank()) {
            throw new OpenAiException("OpenAI API key is not configured (set OPENAI_API_KEY)");
        }
        Map<String, Object> body = Map.of(
                "model", props.draftModel(),
                "temperature", 0.2,
                "response_format", Map.of("type", system.contains("JSON") ? "json_object" : "text"),
                "messages", List.of(
                        Map.of("role", "system", "content", system),
                        Map.of("role", "user", "content", user)));
        try {
            JsonNode res = http.post().uri("/chat/completions")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + props.apiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve().body(JsonNode.class);
            String content = res == null ? null : res.path("choices").path(0).path("message").path("content").asText(null);
            if (content == null || content.isBlank()) throw new OpenAiException("Model returned no content");
            return content;
        } catch (RestClientException ex) {
            throw new OpenAiException("OpenAI request failed: " + ex.getMessage(), ex);
        }
    }

    private JsonNode parseJson(String content) {
        try {
            JsonNode n = mapper.readTree(content);
            if (n == null || !n.isObject()) throw new OpenAiException("Model returned an unexpected shape");
            return n;
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new OpenAiException("Model returned invalid JSON", ex);
        }
    }
}
