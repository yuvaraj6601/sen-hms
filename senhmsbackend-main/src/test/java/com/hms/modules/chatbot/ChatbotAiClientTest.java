package com.hms.modules.chatbot;

import com.hms.modules.chatbot.client.ChatbotOpenAiClient;
import com.hms.modules.chatbot.dto.DataAnswer;
import com.hms.modules.chatbot.dto.DietPlanContent;
import com.hms.modules.chatbot.dto.DietPlanInput;
import com.hms.modules.chatbot.entity.DietRule;
import com.hms.modules.chatbot.enums.DataTool;
import com.hms.modules.prescription.client.OpenAiProperties;
import com.hms.modules.prescription.exception.OpenAiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/** OpenAI is mocked — no network, no real key. */
class ChatbotAiClientTest {

    static final String BASE = "https://api.openai.test/v1";
    RestClient.Builder builder;
    MockRestServiceServer server;
    ChatbotOpenAiClient client;

    @BeforeEach
    void setUp() {
        builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        client = new ChatbotOpenAiClient(builder, new OpenAiProperties("test-key", BASE, "gpt-4o-transcribe", "gpt-4o-mini"));
    }

    private static String chat(String jsonContent) {
        return "{\"choices\":[{\"message\":{\"content\":\"" + jsonContent.replace("\\", "\\\\").replace("\"", "\\\"") + "\"}}]}";
    }

    // ── pickTool ──
    @Test
    void pickTool_returnsToolIdFromModel() {
        server.expect(requestTo(BASE + "/chat/completions"))
              .andExpect(header("Authorization", "Bearer test-key"))
              .andRespond(withSuccess(chat("{\"tool\":\"OP_TODAY\"}"), MediaType.APPLICATION_JSON));

        Optional<String> id = client.pickTool("how busy is OPD", List.of(DataTool.OP_TODAY, DataTool.REVENUE_MONTH));

        assertThat(id).contains("OP_TODAY");
    }

    @Test
    void pickTool_nullToolMeansNoMatch() {
        server.expect(requestTo(BASE + "/chat/completions"))
              .andRespond(withSuccess(chat("{\"tool\":null}"), MediaType.APPLICATION_JSON));

        assertThat(client.pickTool("meaning of life", List.of(DataTool.OP_TODAY))).isEmpty();
    }

    @Test
    void pickTool_promptListsOnlyOfferedTools() {
        server.expect(requestTo(BASE + "/chat/completions"))
              .andExpect(content().string(containsString("OP_TODAY")))
              .andRespond(withSuccess(chat("{\"tool\":null}"), MediaType.APPLICATION_JSON));

        client.pickTool("q", List.of(DataTool.OP_TODAY));
        server.verify();
    }

    @Test
    void pickTool_invalidJson_throwsOpenAiException() {
        server.expect(requestTo(BASE + "/chat/completions"))
              .andRespond(withSuccess(chat("not json"), MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.pickTool("q", List.of(DataTool.OP_TODAY))).isInstanceOf(OpenAiException.class);
    }

    // ── summarize ──
    @Test
    void summarize_returnsModelText_andSendsDataNotIdentifiers() {
        DataAnswer d = new DataAnswer();
        d.setTitle("OP today");
        d.setColumns(List.of("Metric", "Value"));
        d.setRows(List.of(List.of("OP patients", "3")));
        server.expect(requestTo(BASE + "/chat/completions"))
              .andExpect(content().string(containsString("OP patients")))
              .andRespond(withSuccess(chat("There were 3 OP patients today."), MediaType.APPLICATION_JSON));

        assertThat(client.summarize("How many OP patients today?", d)).isEqualTo("There were 3 OP patients today.");
    }

    @Test
    void summarize_upstreamError_throwsOpenAiException() {
        server.expect(requestTo(BASE + "/chat/completions")).andRespond(withStatus(HttpStatus.BAD_GATEWAY));
        assertThatThrownBy(() -> client.summarize("q", new DataAnswer())).isInstanceOf(OpenAiException.class);
    }

    // ── generateDietPlan ──
    private DietPlanInput input() {
        DietPlanInput in = new DietPlanInput();
        in.setAge(30);
        in.setGender("Male");
        in.setHeightCm(172.0);
        in.setWeightKg(72.0);
        in.setConditions(List.of("DIABETES"));
        in.setActivity("Moderate");
        in.setGoal("Manage condition");
        in.setFoodPreference("Vegetarian");
        in.setTargetCalories(2558);
        DietRule r = new DietRule();
        r.setDisplayName("Diabetes");
        r.setForbiddenFoods("sugar,white rice");
        r.setPreferredFoods("millets,oats");
        r.setLowGi(true);
        in.setRules(List.of(r));
        return in;
    }

    @Test
    void generateDietPlan_parsesMealsAvoidAndTips_andPromptCarriesTargetsAndRules() {
        String plan = "{\"summary\":\"Low GI plan\",\"meals\":[{\"name\":\"Breakfast\",\"time\":\"8:00 AM\",\"items\":[\"Oats upma\"]}],"
                + "\"avoid\":[\"sugar\"],\"tips\":[\"Walk after meals\"]}";
        server.expect(requestTo(BASE + "/chat/completions"))
              .andExpect(content().string(containsString("2558")))
              .andExpect(content().string(containsString("white rice")))
              .andExpect(content().string(containsString("Vegetarian")))
              .andRespond(withSuccess(chat(plan), MediaType.APPLICATION_JSON));

        DietPlanContent out = client.generateDietPlan(input());

        assertThat(out.getSummary()).isEqualTo("Low GI plan");
        assertThat(out.getMeals()).hasSize(1);
        assertThat(out.getMeals().get(0).getItems()).containsExactly("Oats upma");
        assertThat(out.getAvoid()).containsExactly("sugar");
        assertThat(out.getTips()).containsExactly("Walk after meals");
    }

    @Test
    void generateDietPlan_invalidJson_throwsOpenAiException() {
        server.expect(requestTo(BASE + "/chat/completions"))
              .andRespond(withSuccess(chat("sorry I cannot"), MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> client.generateDietPlan(input())).isInstanceOf(OpenAiException.class);
    }

    @Test
    void anyCall_withoutApiKey_throwsNotConfigured_andMakesNoRequest() {
        ChatbotOpenAiClient noKey = new ChatbotOpenAiClient(builder, new OpenAiProperties("", BASE, "t", "m"));
        assertThatThrownBy(() -> noKey.generateDietPlan(input()))
                .isInstanceOf(OpenAiException.class).hasMessageContaining("not configured");
        server.verify();
    }
}
