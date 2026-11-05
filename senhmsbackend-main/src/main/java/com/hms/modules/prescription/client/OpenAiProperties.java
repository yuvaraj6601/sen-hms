package com.hms.modules.prescription.client;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Bound from {@code app.openai.*}. The API key comes from the OPENAI_API_KEY env var only. */
@ConfigurationProperties(prefix = "app.openai")
public record OpenAiProperties(
        @DefaultValue("") String apiKey,
        @DefaultValue("https://api.openai.com/v1") String baseUrl,
        @DefaultValue("gpt-4o-transcribe") String transcribeModel,
        @DefaultValue("gpt-4o-mini") String draftModel) {
}
