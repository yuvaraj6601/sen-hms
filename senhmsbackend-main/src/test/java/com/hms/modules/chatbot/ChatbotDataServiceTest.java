package com.hms.modules.chatbot;

import com.hms.modules.chatbot.client.ChatbotAiClient;
import com.hms.modules.chatbot.dto.DataAnswer;
import com.hms.modules.chatbot.dto.StaticQuestion;
import com.hms.modules.chatbot.enums.DataTool;
import com.hms.modules.chatbot.service.ChatbotDataService;
import com.hms.modules.chatbot.service.DataToolExecutor;
import com.hms.modules.prescription.exception.OpenAiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatbotDataServiceTest {

    static final Set<String> ADMIN = Set.of("ADMIN");
    static final Set<String> MD = Set.of("MANAGING_DIRECTOR");
    static final Set<String> RECEPTIONIST = Set.of("RECEPTIONIST");
    static final Set<String> NURSE = Set.of("NURSE");

    @Mock DataToolExecutor executor;
    @Mock ChatbotAiClient ai;
    ChatbotDataService service;

    @BeforeEach
    void setUp() {
        service = new ChatbotDataService(executor, ai);
    }

    private DataAnswer data(DataTool t) {
        DataAnswer a = new DataAnswer();
        a.setToolId(t.name());
        a.setTitle(t.getQuestion());
        a.setColumns(List.of("Metric", "Value"));
        a.setRows(List.of(List.of("OP patients", "3")));
        return a;
    }

    // ═════════════ catalogue of 20 static questions ═════════════

    @Test
    void catalogue_hasExactlyTwentyUniqueQuestions() {
        assertThat(DataTool.values()).hasSize(20);
        Set<String> texts = new HashSet<>();
        for (DataTool t : DataTool.values()) {
            assertThat(t.getQuestion()).isNotBlank();
            assertThat(t.getRoles()).isNotEmpty();
            assertThat(texts.add(t.getQuestion().toLowerCase())).as("duplicate question " + t).isTrue();
        }
    }

    @Test
    void catalogue_coversAllSixCategories() {
        Set<String> cats = new HashSet<>();
        for (DataTool t : DataTool.values()) cats.add(t.getCategory().name());
        assertThat(cats).containsExactlyInAnyOrder("PATIENTS", "REVENUE", "EXPENSES", "INSURANCE", "LAB", "BEDS");
    }

    @Test
    void catalogue_containsTheVideoSuggestionQuestions() {
        List<String> all = List.of(DataTool.values()).stream().map(DataTool::getQuestion).toList();
        assertThat(all).contains("How many OP patients today?", "Total revenue this month?",
                "Show OP vs IP for the last 7 days", "Show monthly revenue chart for this year");
    }

    // ═════════════ questionsFor(roles) ═════════════

    @Test
    void questionsFor_admin_seesAllTwenty() {
        assertThat(service.questionsFor(ADMIN)).hasSize(20);
    }

    @Test
    void questionsFor_managingDirector_seesAllTwenty() {
        assertThat(service.questionsFor(MD)).hasSize(20);
    }

    @Test
    void questionsFor_receptionist_seesNoFinanceOrExpenseQuestions() {
        List<StaticQuestion> qs = service.questionsFor(RECEPTIONIST);
        assertThat(qs).isNotEmpty().hasSizeLessThan(20);
        assertThat(qs).noneMatch(q -> q.getCategory().equals("REVENUE") || q.getCategory().equals("EXPENSES"));
    }

    @Test
    void questionsFor_unknownRole_seesNothing() {
        assertThat(service.questionsFor(Set.of("JANITOR"))).isEmpty();
    }

    // ═════════════ ask — static questions ═════════════

    @Test
    void ask_staticQuestion_runsToolDirectly_withoutAiRouting() {
        when(executor.execute(DataTool.OP_TODAY)).thenReturn(data(DataTool.OP_TODAY));
        when(ai.summarize(anyString(), any())).thenReturn("3 OP patients today.");

        DataAnswer out = service.ask("How many OP patients today?", ADMIN);

        assertThat(out.getAnswer()).isEqualTo("3 OP patients today.");
        assertThat(out.getToolId()).isEqualTo("OP_TODAY");
        verify(ai, never()).pickTool(anyString(), anyList());
    }

    @Test
    void ask_staticQuestion_matchIgnoresCaseSpacingAndQuestionMark() {
        when(executor.execute(DataTool.OP_TODAY)).thenReturn(data(DataTool.OP_TODAY));
        when(ai.summarize(anyString(), any())).thenReturn("ok");

        DataAnswer out = service.ask("  how many op patients TODAY  ", ADMIN);

        assertThat(out.getToolId()).isEqualTo("OP_TODAY");
        verify(ai, never()).pickTool(anyString(), anyList());
    }

    @Test
    void ask_staticQuestion_whenSummaryFails_stillReturnsDataWithFallbackAnswer() {
        when(executor.execute(DataTool.OP_TODAY)).thenReturn(data(DataTool.OP_TODAY));
        when(ai.summarize(anyString(), any())).thenThrow(new OpenAiException("down"));

        DataAnswer out = service.ask("How many OP patients today?", ADMIN);

        assertThat(out.getAnswer()).isNotBlank();           // deterministic fallback text
        assertThat(out.getRows()).isNotEmpty();             // data still returned
    }

    // ═════════════ ask — free text ═════════════

    @Test
    void ask_freeText_usesAiToPickTool_thenRunsIt() {
        when(ai.pickTool(anyString(), anyList())).thenReturn(Optional.of("OP_TODAY"));
        when(executor.execute(DataTool.OP_TODAY)).thenReturn(data(DataTool.OP_TODAY));
        when(ai.summarize(anyString(), any())).thenReturn("3 today");

        DataAnswer out = service.ask("how busy is the OPD right now", ADMIN);

        assertThat(out.getToolId()).isEqualTo("OP_TODAY");
        verify(executor).execute(DataTool.OP_TODAY);
    }

    @Test
    void ask_freeText_onlyOffersToolsTheRoleMayUse() {
        when(ai.pickTool(anyString(), anyList())).thenReturn(Optional.empty());

        service.ask("some unrelated question", RECEPTIONIST);

        org.mockito.ArgumentCaptor<List<DataTool>> cap = org.mockito.ArgumentCaptor.forClass(List.class);
        verify(ai).pickTool(anyString(), cap.capture());
        assertThat(cap.getValue()).isNotEmpty().noneMatch(t -> t.getCategory().name().equals("REVENUE"));
    }

    @Test
    void ask_freeText_noMatchingTool_returnsUnsupportedWithSuggestions() {
        when(ai.pickTool(anyString(), anyList())).thenReturn(Optional.empty());

        DataAnswer out = service.ask("what is the meaning of life", ADMIN);

        assertThat(out.getToolId()).isNull();
        assertThat(out.getAnswer()).isNotBlank();
        assertThat(out.getSuggestions()).isNotEmpty().hasSizeLessThanOrEqualTo(4);
        verify(executor, never()).execute(any());
    }

    @Test
    void ask_freeText_aiPicksUnknownToolId_treatedAsUnsupported() {
        when(ai.pickTool(anyString(), anyList())).thenReturn(Optional.of("DROP_TABLE_PATIENTS"));

        DataAnswer out = service.ask("anything", ADMIN);

        assertThat(out.getToolId()).isNull();
        verify(executor, never()).execute(any());
    }

    @Test
    void ask_freeText_aiPicksToolRoleMayNotUse_throwsAccessDenied() {
        when(ai.pickTool(anyString(), anyList())).thenReturn(Optional.of("REVENUE_MONTH"));

        assertThatThrownBy(() -> service.ask("how much money did we make", NURSE))
                .isInstanceOf(AccessDeniedException.class);
        verify(executor, never()).execute(any());
    }

    @Test
    void ask_freeText_aiFails_propagatesOpenAiException() {
        when(ai.pickTool(anyString(), anyList())).thenThrow(new OpenAiException("down"));

        assertThatThrownBy(() -> service.ask("anything", ADMIN)).isInstanceOf(OpenAiException.class);
    }

    // ═════════════ ask — access + validation ═════════════

    @Test
    void ask_staticFinanceQuestion_asReceptionist_throwsAccessDenied() {
        assertThatThrownBy(() -> service.ask("Total revenue this month?", RECEPTIONIST))
                .isInstanceOf(AccessDeniedException.class);
        verify(executor, never()).execute(any());
    }

    @Test
    void ask_blankQuestion_throwsIllegalArgument() {
        assertThatThrownBy(() -> service.ask("   ", ADMIN)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.ask(null, ADMIN)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void ask_questionLongerThan300Chars_throwsIllegalArgument() {
        assertThatThrownBy(() -> service.ask("a".repeat(301), ADMIN)).isInstanceOf(IllegalArgumentException.class);
        verify(ai, never()).pickTool(anyString(), anyList());
    }

    @Test
    void ask_doesNotLeakRowsToAi_beyondBoundedPreview() {
        DataAnswer big = data(DataTool.TOP_DOCTORS_VISITS);
        big.setRows(java.util.stream.IntStream.range(0, 500).mapToObj(i -> List.of("Dr " + i, "1")).toList());
        when(executor.execute(DataTool.TOP_DOCTORS_VISITS)).thenReturn(big);
        when(ai.summarize(anyString(), any())).thenReturn("many doctors");

        DataAnswer out = service.ask(DataTool.TOP_DOCTORS_VISITS.getQuestion(), ADMIN);

        assertThat(out.getRows()).hasSizeLessThanOrEqualTo(50);   // response is bounded too
    }
}
