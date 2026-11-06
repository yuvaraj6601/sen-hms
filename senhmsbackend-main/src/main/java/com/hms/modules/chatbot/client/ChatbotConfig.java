package com.hms.modules.chatbot.client;

import com.hms.modules.prescription.client.OpenAiProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class ChatbotConfig {

    @Bean
    public ChatbotAiClient chatbotAiClient(RestClient.Builder builder, OpenAiProperties props) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(90_000);   // a full-day diet plan can take a while
        return new ChatbotOpenAiClient(builder.clone().requestFactory(factory), props);
    }
}
