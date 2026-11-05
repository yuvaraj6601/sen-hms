package com.hms.exception;

/**
 * Thrown when a user authenticates with valid credentials but the
 * account is not ACTIVE. Mapped to HTTP 403 by
 * {@link GlobalExceptionHandler}.
 */
public class AccountInactiveException extends RuntimeException {
    public AccountInactiveException(String message) {
        super(message);
    }
}
