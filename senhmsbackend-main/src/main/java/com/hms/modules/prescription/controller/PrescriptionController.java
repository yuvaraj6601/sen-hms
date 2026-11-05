package com.hms.modules.prescription.controller;

import com.hms.common.ApiResponse;
import com.hms.modules.prescription.dto.PrescriptionRequest;
import com.hms.modules.prescription.dto.PrescriptionResponse;
import com.hms.modules.prescription.dto.VoiceDraftResponse;
import com.hms.modules.prescription.service.PrescriptionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/prescriptions")
@RequiredArgsConstructor
public class PrescriptionController {

    private final PrescriptionService service;

    /** Audio in → AI draft out. Nothing is saved. POST /api/prescriptions/voice-draft */
    @PostMapping(value = "/voice-draft", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<VoiceDraftResponse>> voiceDraft(
            @RequestParam(value = "audio", required = false) MultipartFile audio) {
        if (audio == null || audio.isEmpty()) {
            throw new IllegalArgumentException("Audio recording is required");
        }
        return ResponseEntity.ok(ApiResponse.ok(service.createVoiceDraft(audio)));
    }

    /** Doctor-confirmed save. POST /api/prescriptions */
    @PostMapping
    public ResponseEntity<ApiResponse<PrescriptionResponse>> save(@Valid @RequestBody PrescriptionRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.created(service.save(req)));
    }

    /** GET /api/prescriptions?admissionId=5 (or visitId / patientId) */
    @GetMapping
    public ResponseEntity<ApiResponse<List<PrescriptionResponse>>> list(
            @RequestParam(required = false) Long patientId,
            @RequestParam(required = false) Long admissionId,
            @RequestParam(required = false) Long visitId) {
        return ResponseEntity.ok(ApiResponse.ok(service.list(patientId, admissionId, visitId)));
    }
}
