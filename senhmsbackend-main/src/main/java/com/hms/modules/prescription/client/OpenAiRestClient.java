package com.hms.modules.prescription.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.modules.casesheet.enums.MedicationRoute;
import com.hms.modules.prescription.dto.PrescriptionItemDto;
import com.hms.modules.prescription.dto.VoiceDraftResponse;
import com.hms.modules.prescription.enums.PrescriptionTiming;
import com.hms.modules.prescription.exception.OpenAiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.HttpEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.util.List;
import java.util.Map;

/**
 * Thin OpenAI REST client. Only the audio / transcript is ever sent — never patient
 * identifiers. The API key is read from configuration and never logged.
 */
@Slf4j
public class OpenAiRestClient implements OpenAiClient {

    private static final String TRANSCRIBE_HINT =
            "A doctor dictating a medical prescription: drug names, dosages, frequency, duration, diagnosis.";

    private static final String SYSTEM_PROMPT = """
            You convert a doctor's dictated consultation into a structured prescription draft.
            Reply with ONE JSON object only, with exactly these keys:
            {"diagnosis": string|null, "notes": string|null,
             "items": [{"drugName": string, "dosage": string, "frequency": string,
                        "route": "ORAL|IV|IM|SC|TOPICAL|INHALATION|SUBLINGUAL|RECTAL|NASAL|OTHER",
                        "timing": "BEFORE_FOOD|AFTER_FOOD|WITH_FOOD|EMPTY_STOMACH|AT_BEDTIME|AS_DIRECTED"|null,
                        "duration": string|null, "instructions": string|null}]}
            Rules: use only what the doctor actually said; never invent drugs, doses or durations;
            if a required field (dosage / frequency) was not stated use an empty string;
            "1-0-1" style frequencies are kept as spoken; default route is ORAL when a tablet or
            capsule is mentioned and no route is given; put general advice in "notes".
            """;

    private final RestClient http;
    private final OpenAiProperties props;
    private final ObjectMapper mapper = new ObjectMapper();

    public OpenAiRestClient(RestClient.Builder builder, OpenAiProperties props) {
        this.props = props;
        this.http = builder.baseUrl(props.baseUrl()).build();
    }

    @Override
    public String transcribe(byte[] audio, String filename, String contentType) {
        requireKey();
        String name = (filename == null || filename.isBlank()) ? "audio.webm" : filename;
        HttpHeaders fileHeaders = new HttpHeaders();
        fileHeaders.setContentType(MediaType.parseMediaType(contentType));
        fileHeaders.setContentDispositionFormData("file", name);
        MultiValueMap<String, Object> parts = new LinkedMultiValueMap<>();
        parts.add("file", new HttpEntity<>(new ByteArrayResource(audio), fileHeaders));
        parts.add("model", props.transcribeModel());
        parts.add("prompt", TRANSCRIBE_HINT);
        try {
            JsonNode res = http.post().uri("/audio/transcriptions")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + props.apiKey())
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(parts)
                    .retrieve().body(JsonNode.class);
            if (res == null || !res.hasNonNull("text")) {
                throw new OpenAiException("Transcription returned no text");
            }
            return res.get("text").asText();
        } catch (RestClientException ex) {
            throw new OpenAiException("Transcription request failed: " + ex.getMessage(), ex);
        }
    }

    @Override
    public VoiceDraftResponse extractDraft(String transcript) {
        requireKey();
        Map<String, Object> body = Map.of(
                "model", props.draftModel(),
                "temperature", 0,
                "response_format", Map.of("type", "json_object"),
                "messages", List.of(
                        Map.of("role", "system", "content", SYSTEM_PROMPT),
                        Map.of("role", "user", "content", transcript)));
        try {
            JsonNode res = http.post().uri("/chat/completions")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + props.apiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve().body(JsonNode.class);
            String content = res == null ? null : res.path("choices").path(0).path("message").path("content").asText(null);
            if (content == null || content.isBlank()) {
                throw new OpenAiException("Draft generation returned no content");
            }
            return parseDraft(content);
        } catch (RestClientException ex) {
            throw new OpenAiException("Draft request failed: " + ex.getMessage(), ex);
        }
    }

    private VoiceDraftResponse parseDraft(String content) {
        JsonNode root;
        try {
            root = mapper.readTree(content);
        } catch (Exception ex) {
            throw new OpenAiException("Model returned invalid JSON", ex);
        }
        if (root == null || !root.isObject()) {
            throw new OpenAiException("Model returned an unexpected shape");
        }
        VoiceDraftResponse draft = new VoiceDraftResponse();
        draft.setDiagnosis(text(root, "diagnosis"));
        draft.setNotes(text(root, "notes"));
        for (JsonNode n : root.path("items")) {
            PrescriptionItemDto item = new PrescriptionItemDto();
            item.setDrugName(nz(text(n, "drugName")));
            item.setDosage(nz(text(n, "dosage")));
            item.setFrequency(nz(text(n, "frequency")));
            item.setRoute(parseRoute(text(n, "route")));
            item.setTiming(parseTiming(text(n, "timing")));
            item.setDuration(text(n, "duration"));
            item.setInstructions(text(n, "instructions"));
            draft.getItems().add(item);
        }
        return draft;
    }

    private static MedicationRoute parseRoute(String v) {
        if (v == null || v.isBlank()) return MedicationRoute.ORAL;
        try {
            return MedicationRoute.valueOf(v.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return MedicationRoute.OTHER;
        }
    }

    private static PrescriptionTiming parseTiming(String v) {
        if (v == null || v.isBlank()) return null;
        try {
            return PrescriptionTiming.valueOf(v.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.get(field);
        return (v == null || v.isNull()) ? null : v.asText();
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private void requireKey() {
        if (props.apiKey() == null || props.apiKey().isBlank()) {
            throw new OpenAiException("OpenAI API key is not configured (set OPENAI_API_KEY)");
        }
    }
}
