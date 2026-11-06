package com.hms.modules.chatbot;

import com.hms.auth.filter.JwtAuthFilter;
import com.hms.auth.filter.LoginRateLimitFilter;
import com.hms.auth.util.JwtUtil;
import com.hms.config.RestAccessDeniedHandler;
import com.hms.config.RestAuthEntryPoint;
import com.hms.config.SecurityConfig;
import com.hms.exception.GlobalExceptionHandler;
import com.hms.modules.chatbot.controller.ChatbotController;
import com.hms.modules.chatbot.dto.DataAnswer;
import com.hms.modules.chatbot.dto.DietPlanResponse;
import com.hms.modules.chatbot.dto.StaticQuestion;
import com.hms.modules.chatbot.service.ChatbotDataService;
import com.hms.modules.chatbot.service.DietPlanService;
import com.hms.modules.prescription.exception.OpenAiException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Set;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ChatbotController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, LoginRateLimitFilter.class,
         RestAuthEntryPoint.class, RestAccessDeniedHandler.class, GlobalExceptionHandler.class})
class ChatbotControllerTest {

    @Autowired MockMvc mvc;
    @MockBean ChatbotDataService dataService;
    @MockBean DietPlanService dietService;
    @MockBean JwtUtil jwtUtil;

    static final String DIET_BODY = """
        {"age":30,"gender":"Male","heightCm":172,"weightKg":72,
         "conditions":["DIABETES"],"activity":"Moderate","goal":"Manage condition",
         "foodPreference":"Vegetarian","allergies":""}
        """;

    // ═════════ GET /chatbot/questions ═════════

    @Test @WithMockUser(roles = "ADMIN")
    void questions_returnsRoleFilteredList() throws Exception {
        StaticQuestion q = new StaticQuestion();
        q.setId("OP_TODAY"); q.setText("How many OP patients today?"); q.setCategory("PATIENTS");
        when(dataService.questionsFor(any(Set.class))).thenReturn(List.of(q));

        mvc.perform(get("/chatbot/questions"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.data[0].id").value("OP_TODAY"));
    }

    @Test
    void questions_withoutToken_returns401() throws Exception {
        mvc.perform(get("/chatbot/questions")).andExpect(status().isUnauthorized());
    }

    // ═════════ POST /chatbot/data-query ═════════

    @Test @WithMockUser(roles = "ADMIN")
    void dataQuery_asAdmin_returns200() throws Exception {
        DataAnswer a = new DataAnswer();
        a.setAnswer("3 OP patients");
        when(dataService.ask(anyString(), any(Set.class))).thenReturn(a);

        mvc.perform(post("/chatbot/data-query").contentType(APPLICATION_JSON)
                .content("{\"question\":\"How many OP patients today?\"}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.data.answer").value("3 OP patients"));
    }

    @Test
    void dataQuery_withoutToken_returns401() throws Exception {
        mvc.perform(post("/chatbot/data-query").contentType(APPLICATION_JSON).content("{\"question\":\"x\"}"))
           .andExpect(status().isUnauthorized());
    }

    @Test @WithMockUser(roles = "ADMIN")
    void dataQuery_missingQuestion_returns400() throws Exception {
        mvc.perform(post("/chatbot/data-query").contentType(APPLICATION_JSON).content("{}"))
           .andExpect(status().isBadRequest());
    }

    @Test @WithMockUser(roles = "ADMIN")
    void dataQuery_blankQuestion_returns400() throws Exception {
        mvc.perform(post("/chatbot/data-query").contentType(APPLICATION_JSON).content("{\"question\":\"  \"}"))
           .andExpect(status().isBadRequest());
    }

    @Test @WithMockUser(roles = "RECEPTIONIST")
    void dataQuery_toolNotAllowedForRole_returns403() throws Exception {
        when(dataService.ask(anyString(), any(Set.class))).thenThrow(new AccessDeniedException("no"));

        mvc.perform(post("/chatbot/data-query").contentType(APPLICATION_JSON)
                .content("{\"question\":\"Total revenue this month?\"}"))
           .andExpect(status().isForbidden());
    }

    @Test @WithMockUser(roles = "ADMIN")
    void dataQuery_openAiFails_returns502WithSafeMessage() throws Exception {
        when(dataService.ask(anyString(), any(Set.class))).thenThrow(new OpenAiException("secret-detail"));

        mvc.perform(post("/chatbot/data-query").contentType(APPLICATION_JSON).content("{\"question\":\"anything\"}"))
           .andExpect(status().isBadGateway())
           .andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("secret-detail"))));
    }

    // ═════════ POST /chatbot/diet-plan ═════════

    @Test @WithMockUser(roles = "DOCTOR")
    void dietPlan_asDoctor_returns200() throws Exception {
        DietPlanResponse r = new DietPlanResponse();
        r.setTargetCalories(2558);
        when(dietService.generate(any())).thenReturn(r);

        mvc.perform(post("/chatbot/diet-plan").contentType(APPLICATION_JSON).content(DIET_BODY))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.data.targetCalories").value(2558));
    }

    @Test @WithMockUser(roles = "NURSE")
    void dietPlan_asNurse_isAllowed() throws Exception {
        when(dietService.generate(any())).thenReturn(new DietPlanResponse());
        mvc.perform(post("/chatbot/diet-plan").contentType(APPLICATION_JSON).content(DIET_BODY))
           .andExpect(status().isOk());
    }

    @Test
    void dietPlan_withoutToken_returns401() throws Exception {
        mvc.perform(post("/chatbot/diet-plan").contentType(APPLICATION_JSON).content(DIET_BODY))
           .andExpect(status().isUnauthorized());
    }

    @Test @WithMockUser(roles = "RECEPTIONIST")
    void dietPlan_wrongRole_returns403() throws Exception {
        mvc.perform(post("/chatbot/diet-plan").contentType(APPLICATION_JSON).content(DIET_BODY))
           .andExpect(status().isForbidden());
    }

    @Test @WithMockUser(roles = "DOCTOR")
    void dietPlan_missingAge_returns400() throws Exception {
        String body = DIET_BODY.replace("\"age\":30,", "");
        mvc.perform(post("/chatbot/diet-plan").contentType(APPLICATION_JSON).content(body))
           .andExpect(status().isBadRequest());
    }

    @Test @WithMockUser(roles = "DOCTOR")
    void dietPlan_noConditions_returns400() throws Exception {
        String body = DIET_BODY.replace("[\"DIABETES\"]", "[]");
        mvc.perform(post("/chatbot/diet-plan").contentType(APPLICATION_JSON).content(body))
           .andExpect(status().isBadRequest());
    }

    @Test @WithMockUser(roles = "DOCTOR")
    void dietPlan_nonPositiveHeight_returns400() throws Exception {
        String body = DIET_BODY.replace("\"heightCm\":172", "\"heightCm\":0");
        mvc.perform(post("/chatbot/diet-plan").contentType(APPLICATION_JSON).content(body))
           .andExpect(status().isBadRequest());
    }

    @Test @WithMockUser(roles = "DOCTOR")
    void dietPlan_ageOutOfRange_returns400() throws Exception {
        String body = DIET_BODY.replace("\"age\":30", "\"age\":150");
        mvc.perform(post("/chatbot/diet-plan").contentType(APPLICATION_JSON).content(body))
           .andExpect(status().isBadRequest());
    }

    @Test @WithMockUser(roles = "DOCTOR")
    void dietPlan_openAiFails_returns502() throws Exception {
        when(dietService.generate(any())).thenThrow(new OpenAiException("down"));
        mvc.perform(post("/chatbot/diet-plan").contentType(APPLICATION_JSON).content(DIET_BODY))
           .andExpect(status().isBadGateway());
    }

    @Test @WithMockUser(roles = "DOCTOR")
    void dietPlan_serviceRejectsInput_returns400() throws Exception {
        when(dietService.generate(any())).thenThrow(new IllegalArgumentException("Unknown condition"));
        mvc.perform(post("/chatbot/diet-plan").contentType(APPLICATION_JSON).content(DIET_BODY))
           .andExpect(status().isBadRequest());
    }
}
