package com.hms.exception;

/**
 * Thrown when authentication fails due to invalid credentials
 * (unknown email or wrong password). Mapped to HTTP 401 by
 * {@link GlobalExceptionHandler}.
 */
public class AuthenticationFailedException extends RuntimeException {
    public AuthenticationFailedException(String message) {
        super(message);
    }
}
