package com.hms.modules.chatbot.client;

import com.hms.modules.chatbot.dto.DataAnswer;
import com.hms.modules.chatbot.dto.DietPlanContent;
import com.hms.modules.chatbot.dto.DietPlanInput;
import com.hms.modules.chatbot.enums.DataTool;

import java.util.List;
import java.util.Optional;

public interface ChatbotAiClient {

    /** Maps a free-text question to one of the offered tools; empty when none fits. Returns the tool id. */
    Optional<String> pickTool(String question, List<DataTool> candidates);

    /** One-to-three sentence natural-language answer written from the given data only. */
    String summarize(String question, DataAnswer data);

    /** AI-written meal plan that must respect the supplied targets and rules. */
    DietPlanContent generateDietPlan(DietPlanInput input);
}
