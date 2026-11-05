package com.hms.config;

import com.hms.auth.filter.JwtAuthFilter;
import com.hms.auth.filter.LoginRateLimitFilter;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@Configuration
public class AppConfig {

    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * These filters are @Component + OncePerRequestFilter, so Spring Boot would
     * otherwise auto-register them with the servlet container, causing them to
     * run twice (once in the Security chain, once in the servlet chain). Disable
     * the servlet-level auto-registration; they are wired into the Security
     * filter chain explicitly in SecurityConfig.
     */
    @Bean
    public FilterRegistrationBean<JwtAuthFilter> jwtAuthFilterRegistration(JwtAuthFilter filter) {
        FilterRegistrationBean<JwtAuthFilter> reg = new FilterRegistrationBean<>(filter);
        reg.setEnabled(false);
        return reg;
    }

    @Bean
    public FilterRegistrationBean<LoginRateLimitFilter> loginRateLimitFilterRegistration(
            LoginRateLimitFilter filter) {
        FilterRegistrationBean<LoginRateLimitFilter> reg = new FilterRegistrationBean<>(filter);
        reg.setEnabled(false);
        return reg;
    }
}
