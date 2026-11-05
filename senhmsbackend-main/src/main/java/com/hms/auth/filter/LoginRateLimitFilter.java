package com.hms.auth.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hms.common.ApiResponse;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Brute-force / credential-stuffing protection for the public login endpoint.
 *
 * <p>Applies an in-memory token-bucket rate limit, keyed by client IP, to
 * {@code POST /auth/login}. Each IP may make up to {@link #CAPACITY} attempts
 * within a rolling {@link #REFILL_PERIOD}; further attempts receive HTTP 429.
 *
 * <p>NOTE: State is per-instance (in-memory). This is sufficient for a single
 * backend instance. If the backend is scaled to multiple instances, replace the
 * in-memory map with a shared store (e.g. Redis via bucket4j-redis) so limits
 * are enforced across the cluster.
 */
@Slf4j
@Component
@Order(1) // run before JwtAuthFilter
@RequiredArgsConstructor
public class LoginRateLimitFilter extends OncePerRequestFilter {

    /** Max login attempts allowed per IP within REFILL_PERIOD. */
    private static final int CAPACITY = 5;
    /** The window over which the full capacity is refilled. */
    private static final Duration REFILL_PERIOD = Duration.ofMinutes(1);
    /** The login path (context-path "/api" is stripped before matching). */
    private static final String LOGIN_PATH = "/auth/login";

    private final ObjectMapper objectMapper;

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Only rate-limit POST /auth/login; let everything else pass through.
        return !(HttpMethod.POST.matches(request.getMethod())
                && LOGIN_PATH.equals(request.getServletPath()));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {

        String clientIp = resolveClientIp(request);
        Bucket bucket = buckets.computeIfAbsent(clientIp, ip -> newBucket());

        if (bucket.tryConsume(1)) {
            chain.doFilter(request, response);
        } else {
            log.warn("[AUTH] Rate limit exceeded for login attempts from IP={}", clientIp);
            response.setStatus(429); // Too Many Requests
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            objectMapper.writeValue(
                    response.getWriter(),
                    ApiResponse.error("Too many login attempts. Please try again in a minute."));
        }
    }

    private Bucket newBucket() {
        return Bucket.builder()
                .addLimit(limit -> limit.capacity(CAPACITY).refillGreedy(CAPACITY, REFILL_PERIOD))
                .build();
    }

    /**
     * Behind Vercel/Railway the real client IP is in X-Forwarded-For
     * (first entry). Falls back to the remote address for direct connections.
     */
    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(forwarded)) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
