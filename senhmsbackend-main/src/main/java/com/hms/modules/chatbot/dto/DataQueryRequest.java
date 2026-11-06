package com.hms.modules.chatbot.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class DataQueryRequest {

    @NotBlank(message = "Question is required")
    @Size(max = 300, message = "Question is too long")
    private String question;
}
