package com.hms.modules.casesheet.client;

import com.hms.modules.prescription.client.OpenAiProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class CaseSheetAiConfig {

    @Bean
    public CaseSheetAiClient caseSheetAiClient(RestClient.Builder builder, OpenAiProperties props) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10_000);
        factory.setReadTimeout(300_000);   // a 20+ page handwritten case sheet takes minutes to read
        return new CaseSheetOpenAiClient(builder.clone().requestFactory(factory), props);
    }
}
