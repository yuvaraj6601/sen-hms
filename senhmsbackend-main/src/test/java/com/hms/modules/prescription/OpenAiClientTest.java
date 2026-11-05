package com.hms.modules.prescription;

import com.hms.modules.casesheet.enums.MedicationRoute;
import com.hms.modules.prescription.client.OpenAiProperties;
import com.hms.modules.prescription.client.OpenAiRestClient;
import com.hms.modules.prescription.dto.VoiceDraftResponse;
import com.hms.modules.prescription.enums.PrescriptionTiming;
import com.hms.modules.prescription.exception.OpenAiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/** All OpenAI traffic is mocked — these tests never hit the network or need a real key. */
class OpenAiClientTest {

    private static final String BASE = "https://api.openai.test/v1";

    RestClient.Builder builder;
    MockRestServiceServer server;
    OpenAiRestClient client;

    @BeforeEach
    void setUp() {
        builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        client = new OpenAiRestClient(builder,
                new OpenAiProperties("test-key", BASE, "gpt-4o-transcribe", "gpt-4o-mini"));
    }

    @Test
    void transcribe_happyPath_sendsBearerKeyAndReturnsText() {
        server.expect(requestTo(BASE + "/audio/transcriptions"))
              .andExpect(method(HttpMethod.POST))
              .andExpect(header("Authorization", "Bearer test-key"))
              .andRespond(withSuccess("{\"text\":\"tab paracetamol 500 twice daily\"}", MediaType.APPLICATION_JSON));

        String text = client.transcribe(new byte[]{1, 2}, "d.webm", "audio/webm");

        assertThat(text).isEqualTo("tab paracetamol 500 twice daily");
        server.verify();
    }

    @Test
    void transcribe_upstreamError_throwsOpenAiException() {
        server.expect(requestTo(BASE + "/audio/transcriptions"))
              .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));

        assertThatThrownBy(() -> client.transcribe(new byte[]{1}, "d.webm", "audio/webm"))
                .isInstanceOf(OpenAiException.class);
    }

    @Test
    void transcribe_unauthorized_throwsOpenAiException() {
        server.expect(requestTo(BASE + "/audio/transcriptions"))
              .andRespond(withStatus(HttpStatus.UNAUTHORIZED));

        assertThatThrownBy(() -> client.transcribe(new byte[]{1}, "d.webm", "audio/webm"))
                .isInstanceOf(OpenAiException.class);
    }

    @Test
    void transcribe_missingApiKey_throwsOpenAiExceptionWithoutCallingOpenAi() {
        OpenAiRestClient noKey = new OpenAiRestClient(builder,
                new OpenAiProperties("", BASE, "gpt-4o-transcribe", "gpt-4o-mini"));

        assertThatThrownBy(() -> noKey.transcribe(new byte[]{1}, "d.webm", "audio/webm"))
                .isInstanceOf(OpenAiException.class)
                .hasMessageContaining("not configured");
        server.verify();   // no request was expected, none was made
    }

    @Test
    void extractDraft_happyPath_parsesStructuredJsonIntoDraft() {
        String content = """
            {\\"diagnosis\\":\\"Viral fever\\",\\"notes\\":\\"Rest\\",\\"items\\":[
              {\\"drugName\\":\\"Paracetamol\\",\\"dosage\\":\\"500mg\\",\\"frequency\\":\\"1-0-1\\",
               \\"route\\":\\"ORAL\\",\\"timing\\":\\"AFTER_FOOD\\",\\"duration\\":\\"5 days\\",\\"instructions\\":null}]}
            """.replace("\n", " ");
        server.expect(requestTo(BASE + "/chat/completions"))
              .andExpect(header("Authorization", "Bearer test-key"))
              .andRespond(withSuccess("{\"choices\":[{\"message\":{\"content\":\"" + content + "\"}}]}",
                      MediaType.APPLICATION_JSON));

        VoiceDraftResponse d = client.extractDraft("tab paracetamol 500 twice daily after food 5 days");

        assertThat(d.getDiagnosis()).isEqualTo("Viral fever");
        assertThat(d.getItems()).hasSize(1);
        assertThat(d.getItems().get(0).getDrugName()).isEqualTo("Paracetamol");
        assertThat(d.getItems().get(0).getRoute()).isEqualTo(MedicationRoute.ORAL);
        assertThat(d.getItems().get(0).getTiming()).isEqualTo(PrescriptionTiming.AFTER_FOOD);
    }

    @Test
    void extractDraft_unknownRouteAndTiming_fallBackToOtherAndNull() {
        String content = "{\\\"items\\\":[{\\\"drugName\\\":\\\"X\\\",\\\"dosage\\\":\\\"1\\\",\\\"frequency\\\":\\\"OD\\\","
                + "\\\"route\\\":\\\"WEIRD\\\",\\\"timing\\\":\\\"WHENEVER\\\"}]}";
        server.expect(requestTo(BASE + "/chat/completions"))
              .andRespond(withSuccess("{\"choices\":[{\"message\":{\"content\":\"" + content + "\"}}]}",
                      MediaType.APPLICATION_JSON));

        VoiceDraftResponse d = client.extractDraft("x");

        assertThat(d.getItems().get(0).getRoute()).isEqualTo(MedicationRoute.OTHER);
        assertThat(d.getItems().get(0).getTiming()).isNull();
    }

    @Test
    void extractDraft_modelReturnsInvalidJson_throwsOpenAiException() {
        server.expect(requestTo(BASE + "/chat/completions"))
              .andRespond(withSuccess("{\"choices\":[{\"message\":{\"content\":\"not json at all\"}}]}",
                      MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.extractDraft("x")).isInstanceOf(OpenAiException.class);
    }

    @Test
    void extractDraft_upstreamError_throwsOpenAiException() {
        server.expect(requestTo(BASE + "/chat/completions"))
              .andRespond(withStatus(HttpStatus.BAD_GATEWAY));

        assertThatThrownBy(() -> client.extractDraft("x")).isInstanceOf(OpenAiException.class);
    }
}
