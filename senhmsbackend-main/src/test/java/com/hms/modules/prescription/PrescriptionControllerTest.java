package com.hms.modules.prescription;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.auth.filter.JwtAuthFilter;
import com.hms.auth.filter.LoginRateLimitFilter;
import com.hms.auth.util.JwtUtil;
import com.hms.config.RestAccessDeniedHandler;
import com.hms.config.RestAuthEntryPoint;
import com.hms.config.SecurityConfig;
import com.hms.exception.GlobalExceptionHandler;
import com.hms.modules.prescription.controller.PrescriptionController;
import com.hms.modules.prescription.dto.PrescriptionResponse;
import com.hms.modules.prescription.dto.VoiceDraftResponse;
import com.hms.modules.prescription.exception.OpenAiException;
import com.hms.modules.prescription.service.PrescriptionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.http.MediaType.APPLICATION_JSON;

@WebMvcTest(PrescriptionController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, LoginRateLimitFilter.class,
         RestAuthEntryPoint.class, RestAccessDeniedHandler.class, GlobalExceptionHandler.class})
class PrescriptionControllerTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockBean PrescriptionService service;
    @MockBean JwtUtil jwtUtil;

    private final MockMultipartFile audio =
            new MockMultipartFile("audio", "d.webm", "audio/webm", new byte[]{1, 2, 3});

    private static final String VALID_BODY = """
        {"patientId":1,"uhid":"UH001","doctorName":"Dr. Ravi","source":"VOICE",
         "voiceTranscript":"tab paracetamol",
         "items":[{"drugName":"Paracetamol","dosage":"500mg","frequency":"1-0-1","route":"ORAL"}]}
        """;

    // ═════════════ POST /prescriptions/voice-draft ═════════════

    @Test @WithMockUser(roles = "DOCTOR")
    void voiceDraft_asDoctor_returns200WithDraft() throws Exception {
        VoiceDraftResponse d = new VoiceDraftResponse();
        d.setTranscript("tab paracetamol");
        when(service.createVoiceDraft(any())).thenReturn(d);

        mvc.perform(multipart("/prescriptions/voice-draft").file(audio))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.success").value(true))
           .andExpect(jsonPath("$.data.transcript").value("tab paracetamol"));
    }

    @Test @WithMockUser(roles = "ADMIN")
    void voiceDraft_asAdmin_isAllowed() throws Exception {
        when(service.createVoiceDraft(any())).thenReturn(new VoiceDraftResponse());
        mvc.perform(multipart("/prescriptions/voice-draft").file(audio)).andExpect(status().isOk());
    }

    @Test
    void voiceDraft_withoutToken_returns401() throws Exception {
        mvc.perform(multipart("/prescriptions/voice-draft").file(audio))
           .andExpect(status().isUnauthorized());
    }

    @Test @WithMockUser(roles = "RECEPTIONIST")
    void voiceDraft_wrongRole_returns403() throws Exception {
        mvc.perform(multipart("/prescriptions/voice-draft").file(audio))
           .andExpect(status().isForbidden());
    }

    @Test @WithMockUser(roles = "NURSE")
    void voiceDraft_nurse_returns403() throws Exception {
        mvc.perform(multipart("/prescriptions/voice-draft").file(audio))
           .andExpect(status().isForbidden());
    }

    @Test @WithMockUser(roles = "DOCTOR")
    void voiceDraft_missingAudioPart_returns400() throws Exception {
        mvc.perform(multipart("/prescriptions/voice-draft"))
           .andExpect(status().isBadRequest());
    }

    @Test @WithMockUser(roles = "DOCTOR")
    void voiceDraft_serviceRejectsAudio_returns400WithMessage() throws Exception {
        when(service.createVoiceDraft(any())).thenThrow(new IllegalArgumentException("No speech detected"));

        mvc.perform(multipart("/prescriptions/voice-draft").file(audio))
           .andExpect(status().isBadRequest())
           .andExpect(jsonPath("$.success").value(false))
           .andExpect(jsonPath("$.error").value("No speech detected"));
    }

    @Test @WithMockUser(roles = "DOCTOR")
    void voiceDraft_openAiFails_returns502WithSafeMessage() throws Exception {
        when(service.createVoiceDraft(any())).thenThrow(new OpenAiException("upstream 500: secret-detail"));

        mvc.perform(multipart("/prescriptions/voice-draft").file(audio))
           .andExpect(status().isBadGateway())
           .andExpect(jsonPath("$.success").value(false))
           .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.not(
                   org.hamcrest.Matchers.containsString("secret-detail"))));
    }

    // ═════════════ POST /prescriptions ═════════════

    @Test @WithMockUser(roles = "DOCTOR")
    void save_asDoctor_returns201() throws Exception {
        PrescriptionResponse r = new PrescriptionResponse();
        r.setId(10L);
        when(service.save(any())).thenReturn(r);

        mvc.perform(post("/prescriptions").contentType(APPLICATION_JSON).content(VALID_BODY))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.data.id").value(10));
    }

    @Test
    void save_withoutToken_returns401() throws Exception {
        mvc.perform(post("/prescriptions").contentType(APPLICATION_JSON).content(VALID_BODY))
           .andExpect(status().isUnauthorized());
    }

    @Test @WithMockUser(roles = "RECEPTIONIST")
    void save_wrongRole_returns403() throws Exception {
        mvc.perform(post("/prescriptions").contentType(APPLICATION_JSON).content(VALID_BODY))
           .andExpect(status().isForbidden());
    }

    @Test @WithMockUser(roles = "DOCTOR")
    void save_missingItems_returns400() throws Exception {
        String body = """
            {"patientId":1,"uhid":"UH001","doctorName":"Dr. Ravi","items":[]}
            """;
        mvc.perform(post("/prescriptions").contentType(APPLICATION_JSON).content(body))
           .andExpect(status().isBadRequest());
    }

    @Test @WithMockUser(roles = "DOCTOR")
    void save_itemMissingDrugName_returns400() throws Exception {
        String body = """
            {"patientId":1,"uhid":"UH001","doctorName":"Dr. Ravi",
             "items":[{"dosage":"500mg","frequency":"1-0-1","route":"ORAL"}]}
            """;
        mvc.perform(post("/prescriptions").contentType(APPLICATION_JSON).content(body))
           .andExpect(status().isBadRequest());
    }

    @Test @WithMockUser(roles = "DOCTOR")
    void save_missingPatientId_returns400() throws Exception {
        String body = """
            {"uhid":"UH001","doctorName":"Dr. Ravi",
             "items":[{"drugName":"Paracetamol","dosage":"500mg","frequency":"1-0-1"}]}
            """;
        mvc.perform(post("/prescriptions").contentType(APPLICATION_JSON).content(body))
           .andExpect(status().isBadRequest());
    }

    @Test @WithMockUser(roles = "DOCTOR")
    void save_dischargedAdmission_returns409() throws Exception {
        when(service.save(any())).thenThrow(new IllegalStateException("already discharged"));

        mvc.perform(post("/prescriptions").contentType(APPLICATION_JSON).content(VALID_BODY))
           .andExpect(status().isConflict());
    }

    @Test @WithMockUser(roles = "DOCTOR")
    void save_unknownPatient_returns404() throws Exception {
        when(service.save(any())).thenThrow(new com.hms.exception.ResourceNotFoundException("Patient", 1L));

        mvc.perform(post("/prescriptions").contentType(APPLICATION_JSON).content(VALID_BODY))
           .andExpect(status().isNotFound());
    }

    // ═════════════ GET /prescriptions ═════════════

    @Test @WithMockUser(roles = "NURSE")
    void list_asNurse_returns200() throws Exception {
        when(service.list(any(), any(), any())).thenReturn(List.of(new PrescriptionResponse()));

        mvc.perform(get("/prescriptions").param("admissionId", "7"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.data.length()").value(1));
    }

    @Test
    void list_withoutToken_returns401() throws Exception {
        mvc.perform(get("/prescriptions").param("admissionId", "7"))
           .andExpect(status().isUnauthorized());
    }

    @Test @WithMockUser(roles = "DOCTOR")
    void list_noFilter_returns400() throws Exception {
        when(service.list(any(), any(), any())).thenThrow(new IllegalArgumentException("Provide patientId, admissionId, or visitId"));

        mvc.perform(get("/prescriptions"))
           .andExpect(status().isBadRequest());
    }
}
