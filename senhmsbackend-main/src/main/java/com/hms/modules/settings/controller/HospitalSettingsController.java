package com.hms.modules.settings.controller;

import com.hms.common.ApiResponse;
import com.hms.modules.settings.dto.HospitalSettingsRequest;
import com.hms.modules.settings.dto.HospitalSettingsResponse;
import com.hms.modules.settings.service.HospitalSettingsService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/settings/hospital")
@RequiredArgsConstructor
public class HospitalSettingsController {

    private final HospitalSettingsService service;

    /** GET /api/settings/hospital */
    @GetMapping
    public ResponseEntity<ApiResponse<HospitalSettingsResponse>> get() {
        return ResponseEntity.ok(ApiResponse.ok(service.get()));
    }

    /** PUT /api/settings/hospital */
    @PutMapping
    public ResponseEntity<ApiResponse<HospitalSettingsResponse>> save(
            @Valid @RequestBody HospitalSettingsRequest req) {
        return ResponseEntity.ok(ApiResponse.ok("Settings saved", service.save(req)));
    }
}
