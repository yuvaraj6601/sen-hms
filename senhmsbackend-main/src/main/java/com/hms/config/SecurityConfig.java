package com.hms.config;

import com.hms.auth.filter.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Central security configuration.
 *
 * <p>Role-based access control is expressed here as URL + HTTP-method rules,
 * mirroring the frontend permission matrix in {@code HMS/app/_lib/auth.ts}.
 * This is the single source of truth for server-side authorization — it is a
 * real security control, unlike the frontend matrix which only shapes the UI.
 *
 * <p>Convention:
 * <ul>
 *   <li>GET      → "view" permission</li>
 *   <li>POST/PUT/PATCH/DELETE → "edit/delete" (write) permission</li>
 * </ul>
 *
 * <p>Role authorities are set by {@code JwtAuthFilter} as {@code ROLE_<enum>},
 * so {@code hasAnyRole(...)} uses the {@link com.hms.masters.enums.UserRole}
 * enum names. MANAGING_DIRECTOR and ADMIN have full access to every module and
 * are therefore included in every rule.
 */
@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final com.hms.auth.filter.LoginRateLimitFilter loginRateLimitFilter;
    private final RestAuthEntryPoint restAuthEntryPoint;
    private final RestAccessDeniedHandler restAccessDeniedHandler;

    // Role name constants (enum names; Spring adds the ROLE_ prefix via hasAnyRole)
    private static final String MD  = "MANAGING_DIRECTOR";
    private static final String AD  = "ADMIN";
    private static final String DR  = "DOCTOR";
    private static final String RC  = "RECEPTIONIST";
    private static final String LT  = "LAB_TECH";
    private static final String IC  = "INSURANCE_COORDINATOR";
    private static final String NU  = "NURSE";
    private static final String LIR = "LAB_INS_REC";

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(cors -> {})   // uses CorsConfig bean
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint(restAuthEntryPoint)   // 401 JSON
                .accessDeniedHandler(restAccessDeniedHandler)   // 403 JSON
            )
            .authorizeHttpRequests(auth -> auth
                // ── Public endpoints ────────────────────────────────────────
                .requestMatchers("/auth/login", "/auth/refresh").permitAll()
                // QR self-registration — no JWT, called from patient's phone
                .requestMatchers(HttpMethod.POST, "/op-visits/self-register").permitAll()
                // NABH patient feedback — public QR form, submitted from the patient's phone
                .requestMatchers(HttpMethod.POST, "/feedback/submit").permitAll()

                // ── Dashboard — all authenticated users ─────────────────────
                .requestMatchers("/dashboard/**").authenticated()

                // ── Masters: Users (MD/Admin only, all operations) ──────────
                .requestMatchers("/masters/users/**").hasAnyRole(MD, AD)

                // ── Masters: Expense categories (MD/Admin only) ─────────────
                .requestMatchers("/masters/expense-categories/**").hasAnyRole(MD, AD)

                // ── Masters: Doctors ────────────────────────────────────────
                .requestMatchers(HttpMethod.GET, "/masters/doctors/**").hasAnyRole(MD, AD, DR, RC, NU, LIR)
                .requestMatchers("/masters/doctors/**").hasAnyRole(MD, AD)

                // ── Masters: Referrers ──────────────────────────────────────
                .requestMatchers(HttpMethod.GET, "/masters/referrers/**").hasAnyRole(MD, AD, DR, RC, LIR)
                .requestMatchers("/masters/referrers/**").hasAnyRole(MD, AD, RC, LIR)

                // ── Masters: Departments ────────────────────────────────────
                .requestMatchers(HttpMethod.GET, "/masters/departments/**").hasAnyRole(MD, AD, DR, RC, LT, NU, LIR)
                .requestMatchers("/masters/departments/**").hasAnyRole(MD, AD)

                // ── Masters: Investigations ─────────────────────────────────
                .requestMatchers(HttpMethod.GET, "/masters/investigations/**").hasAnyRole(MD, AD, DR, LT, LIR)
                .requestMatchers("/masters/investigations/**").hasAnyRole(MD, AD, LT, LIR)

                // ── Masters: Lab masters ────────────────────────────────────
                // GET (read list for lab ordering) open to Receptionist too;
                // write (create/edit/toggle) stays with MD/Admin/Lab/LIR.
                .requestMatchers(HttpMethod.GET, "/masters/lab-masters/**").hasAnyRole(MD, AD, LT, RC, LIR)
                .requestMatchers("/masters/lab-masters/**").hasAnyRole(MD, AD, LT, LIR)

                // ── Masters: Billing modality / masters ─────────────────────
                .requestMatchers(HttpMethod.GET, "/masters/billing-modalities/**").hasAnyRole(MD, AD, RC, LIR)
                .requestMatchers("/masters/billing-modalities/**").hasAnyRole(MD, AD)
                .requestMatchers(HttpMethod.GET, "/masters/billing-masters/**").hasAnyRole(MD, AD, RC, LIR)
                .requestMatchers("/masters/billing-masters/**").hasAnyRole(MD, AD)

                // ── Masters: Insurance companies / tariffs ──────────────────
                .requestMatchers("/masters/insurance-companies/**").hasAnyRole(MD, AD, IC, LIR)
                .requestMatchers("/masters/insurance-tariffs/**").hasAnyRole(MD, AD, IC, LIR)

                // ── Masters: Wards / beds ───────────────────────────────────
                .requestMatchers(HttpMethod.GET, "/masters/wards/**").hasAnyRole(MD, AD, DR, RC, NU, LIR)
                .requestMatchers("/masters/wards/**").hasAnyRole(MD, AD, NU)

                // ── Masters: ICD codes ──────────────────────────────────────
                .requestMatchers(HttpMethod.GET, "/masters/icd-codes/**").hasAnyRole(MD, AD, DR, IC, LIR)
                .requestMatchers("/masters/icd-codes/**").hasAnyRole(MD, AD)

                // ── OP Visits ───────────────────────────────────────────────
                .requestMatchers(HttpMethod.GET, "/op-visits/**").hasAnyRole(MD, AD, DR, RC, NU, LIR)
                .requestMatchers("/op-visits/**").hasAnyRole(MD, AD, DR, RC, LIR)

                // ── Admissions ──────────────────────────────────────────────
                .requestMatchers(HttpMethod.GET, "/admissions/**").hasAnyRole(MD, AD, DR, RC, IC, NU, LIR)
                .requestMatchers("/admissions/**").hasAnyRole(MD, AD, DR, RC, LIR)

                // ── Discharge summary ───────────────────────────────────────
                .requestMatchers(HttpMethod.GET, "/discharge-summary/**").hasAnyRole(MD, AD, DR, RC, IC, NU, LIR)
                .requestMatchers("/discharge-summary/**").hasAnyRole(MD, AD, DR)

                // ── Case sheet (clinical — doctors/nurses) ──────────────────
                .requestMatchers(HttpMethod.GET, "/case-sheet/**").hasAnyRole(MD, AD, DR, RC, IC, NU, LIR)
                .requestMatchers("/case-sheet/**").hasAnyRole(MD, AD, DR, NU)

                // ── Case sheet documents (upload / download / delete) ────────
                // GET (list + download) — all who can view case sheet
                // POST (upload)         — doctors, nurses, admin, MD
                // DELETE                — doctors, admin, MD only
                .requestMatchers(HttpMethod.GET,    "/case-sheet/documents/**").hasAnyRole(MD, AD, DR, RC, IC, NU, LIR)
                .requestMatchers(HttpMethod.POST,   "/case-sheet/documents/**").hasAnyRole(MD, AD, DR, NU, LIR)
                .requestMatchers(HttpMethod.DELETE, "/case-sheet/documents/**").hasAnyRole(MD, AD, DR)

                // ── Patients ────────────────────────────────────────────────
                .requestMatchers(HttpMethod.GET, "/patients/**").hasAnyRole(MD, AD, DR, RC, LT, IC, NU, LIR)
                .requestMatchers("/patients/**").hasAnyRole(MD, AD, DR, RC, NU, LIR)

                // ── Lab investigations ──────────────────────────────────────
                // Receptionist can view and place/manage lab orders (e.g. from
                // the case sheet Lab Orders tab), same as Admin.
                .requestMatchers(HttpMethod.GET, "/lab/investigations/**").hasAnyRole(MD, AD, DR, LT, RC, NU, LIR)
                .requestMatchers("/lab/investigations/**").hasAnyRole(MD, AD, LT, RC, LIR)

                // ── Lab file upload & serve ──────────────────────────────────
                // POST /{id}/upload — lab techs, admin, MD
                // GET  /files/**    — anyone who can view lab results
                .requestMatchers(HttpMethod.GET, "/lab/investigations/files/**").hasAnyRole(MD, AD, DR, LT, RC, NU, LIR)
                .requestMatchers(HttpMethod.POST, "/lab/investigations/*/upload").hasAnyRole(MD, AD, LT, LIR)

                // ── Appointments ────────────────────────────────────────────
                .requestMatchers(HttpMethod.GET, "/appointments/**").hasAnyRole(MD, AD, DR, RC, NU, LIR)
                .requestMatchers("/appointments/**").hasAnyRole(MD, AD, DR, RC, LIR)

                // ── Bills ───────────────────────────────────────────────────
                .requestMatchers(HttpMethod.GET, "/bills/**").hasAnyRole(MD, AD, DR, RC, IC, LIR)
                .requestMatchers("/bills/**").hasAnyRole(MD, AD, RC, LIR)

                // ── Insurance claims ────────────────────────────────────────
                .requestMatchers("/insurance/claims/**").hasAnyRole(MD, AD, IC, LIR)

                // ── Expenses ────────────────────────────────────────────────
                .requestMatchers(HttpMethod.GET, "/expenses/**").hasAnyRole(MD, AD, RC, LT, IC, NU, LIR)
                .requestMatchers("/expenses/**").hasAnyRole(MD, AD)

                // ── Contacts ────────────────────────────────────────────────
                .requestMatchers(HttpMethod.GET, "/contacts/**").hasAnyRole(MD, AD, DR, RC, IC, LIR)
                .requestMatchers("/contacts/**").hasAnyRole(MD, AD, RC, LIR)

                // ── Pharmacy (tied to daily-summary pharmacy collection) ────
                .requestMatchers("/pharmacy/**").hasAnyRole(MD, AD, RC, LIR)

                // ── Daily summary ───────────────────────────────────────────
                .requestMatchers(HttpMethod.GET, "/daily-summary/**").hasAnyRole(MD, AD, RC, IC, LIR)
                // Receptionist has full (create/edit/submit) access to daily cash
                // collection, matching Admin — insurance claims live under /insurance/**.
                .requestMatchers("/daily-summary/**").hasAnyRole(MD, AD, RC)

                // ── Reports (read-only; sensitive financials) ───────────────
                .requestMatchers(HttpMethod.GET, "/reports/**").hasAnyRole(MD, AD, RC, LIR)
                .requestMatchers("/reports/**").hasAnyRole(MD, AD)

                // ── Patient feedback (NABH) ─────────────────────────────────
                // Public submit is permitAll above. Staff review/list/detail is
                // read-only for the front-office/quality roles.
                .requestMatchers(HttpMethod.GET, "/feedback/**").hasAnyRole(MD, AD, RC, NU, LIR)
                .requestMatchers("/feedback/**").hasAnyRole(MD, AD)

                // ── Settings ────────────────────────────────────────────────
                // Hospital info (name, address, logo, letterhead) is non-sensitive
                // and is needed to render printed bills/reports. Allow GET for the
                // roles that print; all writes and other settings stay MD/Admin.
                .requestMatchers(HttpMethod.GET, "/settings/hospital", "/settings/hospital/**").hasAnyRole(MD, AD, RC, DR, IC, LT, NU, LIR)
                .requestMatchers("/settings/**").hasAnyRole(MD, AD)

                // ── Everything else requires a valid JWT ────────────────────
                .anyRequest().authenticated()
            )
            // Rate-limit login attempts before authentication processing
            .addFilterBefore(loginRateLimitFilter, UsernamePasswordAuthenticationFilter.class)
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
