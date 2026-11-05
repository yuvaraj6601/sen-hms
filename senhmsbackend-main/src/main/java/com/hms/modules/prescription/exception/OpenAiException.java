package com.hms.modules.prescription.exception;

/** Raised when the OpenAI call fails or returns something unusable. */
public class OpenAiException extends RuntimeException {
    public OpenAiException(String message) {
        super(message);
    }

    public OpenAiException(String message, Throwable cause) {
        super(message, cause);
    }
}
