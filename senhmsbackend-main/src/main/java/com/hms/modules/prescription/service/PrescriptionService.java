package com.hms.modules.prescription.service;

import com.hms.common.AuditLogService;
import com.hms.exception.ResourceNotFoundException;
import com.hms.modules.admission.entity.Admission;
import com.hms.modules.admission.enums.AdmissionStatus;
import com.hms.modules.admission.repository.AdmissionRepository;
import com.hms.modules.patient.entity.Patient;
import com.hms.modules.patient.repository.PatientRepository;
import com.hms.modules.prescription.client.OpenAiClient;
import com.hms.modules.prescription.dto.PrescriptionItemDto;
import com.hms.modules.prescription.dto.PrescriptionRequest;
import com.hms.modules.prescription.dto.PrescriptionResponse;
import com.hms.modules.prescription.dto.VoiceDraftResponse;
import com.hms.modules.prescription.entity.Prescription;
import com.hms.modules.prescription.entity.PrescriptionItem;
import com.hms.modules.prescription.enums.PrescriptionSource;
import com.hms.modules.prescription.repository.PrescriptionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

@Slf4j
@Service
@RequiredArgsConstructor
public class PrescriptionService {

    static final long MAX_AUDIO_BYTES = 10L * 1024 * 1024;
    static final long MAX_IMAGE_BYTES = 10L * 1024 * 1024;
    private static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp");

    private final PrescriptionRepository repo;
    private final PatientRepository patientRepo;
    private final AdmissionRepository admissionRepo;
    private final OpenAiClient openAi;
    private final AuditLogService auditLogService;

    // ── Voice → draft (NOT persisted) ─────────────────────────────────────────

    public VoiceDraftResponse createVoiceDraft(MultipartFile audio) {
        if (audio == null || audio.isEmpty()) {
            throw new IllegalArgumentException("Audio recording is required");
        }
        String contentType = audio.getContentType();
        if (contentType == null || !contentType.toLowerCase().startsWith("audio/")) {
            throw new IllegalArgumentException("Only audio files are accepted");
        }
        if (audio.getSize() > MAX_AUDIO_BYTES) {
            throw new IllegalArgumentException("Recording is too large (max 10 MB)");
        }
        byte[] bytes;
        try {
            bytes = audio.getBytes();
        } catch (IOException ex) {
            log.error("[PRESCRIPTION] could not read uploaded audio", ex);
            throw new IllegalArgumentException("Could not read the recording");
        }
        log.info("[PRESCRIPTION] voice draft requested sizeBytes={}", bytes.length);

        String transcript = openAi.transcribe(bytes, audio.getOriginalFilename(), contentType);
        if (transcript == null || transcript.isBlank()) {
            throw new IllegalArgumentException("No speech detected in the recording");
        }
        VoiceDraftResponse draft = openAi.extractDraft(transcript);
        draft.setTranscript(transcript);
        if (draft.getItems() == null) {
            draft.setItems(new ArrayList<>());
        }
        return draft;
    }

    // ── Handwritten image → draft (NOT persisted, image is not stored) ────────

    public VoiceDraftResponse createImageDraft(MultipartFile image) {
        if (image == null || image.isEmpty()) {
            throw new IllegalArgumentException("Prescription image is required");
        }
        String contentType = image.getContentType() == null ? "" : image.getContentType().toLowerCase();
        if (contentType.equals("image/jpg")) contentType = "image/jpeg";
        if (!IMAGE_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("Only JPG, PNG or WEBP images are accepted");
        }
        if (image.getSize() > MAX_IMAGE_BYTES) {
            throw new IllegalArgumentException("Image is too large (max 10 MB)");
        }
        byte[] bytes;
        try {
            bytes = image.getBytes();
        } catch (IOException ex) {
            log.error("[PRESCRIPTION] could not read uploaded image", ex);
            throw new IllegalArgumentException("Could not read the image");
        }
        log.info("[PRESCRIPTION] image draft requested sizeBytes={}", bytes.length);

        VoiceDraftResponse draft = openAi.extractDraftFromImage(bytes, contentType);
        if (draft.getItems() == null) {
            draft.setItems(new ArrayList<>());
        }
        if (draft.getItems().isEmpty() && (draft.getTranscript() == null || draft.getTranscript().isBlank())) {
            throw new IllegalArgumentException("No prescription could be read from the image. Try a clearer photo.");
        }
        return draft;
    }

    // ── Doctor-confirmed save ─────────────────────────────────────────────────

    @Transactional
    public PrescriptionResponse save(PrescriptionRequest req) {
        if (req.getItems() == null || req.getItems().isEmpty()) {
            throw new IllegalArgumentException("At least one medicine is required");
        }
        Patient patient = patientRepo.findById(req.getPatientId())
                .orElseThrow(() -> new ResourceNotFoundException("Patient", req.getPatientId()));
        if (req.getAdmissionId() != null) {
            Admission admission = admissionRepo.findById(req.getAdmissionId())
                    .orElseThrow(() -> new ResourceNotFoundException("Admission", req.getAdmissionId()));
            if (admission.getStatus() == AdmissionStatus.DISCHARGED) {
                throw new IllegalStateException(
                        "Cannot prescribe — admission " + admission.getAdmissionNo() + " is already discharged.");
            }
        }

        PrescriptionSource source = req.getSource() == null ? PrescriptionSource.MANUAL : req.getSource();
        boolean aiDraft = source != PrescriptionSource.MANUAL;
        Prescription rx = new Prescription();
        rx.setPrescriptionNo(newPrescriptionNo());
        rx.setPatientId(String.valueOf(patient.getId()));
        rx.setUhid(patient.getUhid());
        rx.setPatientName(patient.getName());
        rx.setAge(patient.getAge());
        rx.setGender(patient.getGender() != null ? patient.getGender().name() : null);
        rx.setDepartment(patient.getDepartment());
        rx.setAdmissionId(req.getAdmissionId());
        rx.setVisitId(req.getVisitId());
        rx.setDoctorId(req.getDoctorId() != null ? String.valueOf(req.getDoctorId()) : null);
        rx.setDoctorName(req.getDoctorName());
        rx.setVisitDate(LocalDate.now());
        rx.setDiagnosis(req.getDiagnosis());
        rx.setNotes(req.getNotes());
        rx.setSource(source);
        rx.setVoiceTranscript(aiDraft ? req.getVoiceTranscript() : null);

        int order = 0;
        for (PrescriptionItemDto dto : req.getItems()) {
            PrescriptionItem item = new PrescriptionItem();
            item.setPrescription(rx);
            item.setDrugName(dto.getDrugName());
            item.setDosage(dto.getDosage());
            item.setFrequency(dto.getFrequency());
            item.setRoute(dto.getRoute() != null ? dto.getRoute()
                    : com.hms.modules.casesheet.enums.MedicationRoute.ORAL);
            item.setTiming(dto.getTiming());
            item.setDuration(dto.getDuration());
            item.setInstructions(dto.getInstructions());
            item.setSortOrder(order++);
            rx.getItems().add(item);
        }

        Prescription saved = repo.save(rx);
        auditLogService.log("Prescription", saved.getId(), "PRESCRIBE", currentUser(),
                "patientId=" + saved.getPatientId() + " source=" + saved.getSource() + " items=" + saved.getItems().size());
        log.info("[PRESCRIPTION] saved id={} source={} items={}", saved.getId(), saved.getSource(), saved.getItems().size());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<PrescriptionResponse> list(Long patientId, Long admissionId, Long visitId) {
        List<Prescription> rows;
        if (admissionId != null) {
            rows = repo.findByAdmissionIdOrderByIdDesc(admissionId);
        } else if (visitId != null) {
            rows = repo.findByVisitIdOrderByIdDesc(visitId);
        } else if (patientId != null) {
            rows = repo.findByPatientIdOrderByIdDesc(String.valueOf(patientId));
        } else {
            throw new IllegalArgumentException("Provide patientId, admissionId, or visitId");
        }
        return rows.stream().map(this::toResponse).toList();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private String newPrescriptionNo() {
        return "RX-" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"))
                + "-" + ThreadLocalRandom.current().nextInt(100, 1000);
    }

    private PrescriptionResponse toResponse(Prescription p) {
        PrescriptionResponse r = new PrescriptionResponse();
        r.setId(p.getId());
        r.setPrescriptionNo(p.getPrescriptionNo());
        r.setPatientId(p.getPatientId());
        r.setUhid(p.getUhid());
        r.setPatientName(p.getPatientName());
        r.setAdmissionId(p.getAdmissionId());
        r.setVisitId(p.getVisitId());
        r.setDoctorName(p.getDoctorName());
        r.setVisitDate(p.getVisitDate());
        r.setDiagnosis(p.getDiagnosis());
        r.setNotes(p.getNotes());
        r.setSource(p.getSource());
        r.setVoiceTranscript(p.getVoiceTranscript());
        r.setCreatedAt(p.getCreatedAt());
        for (PrescriptionItem i : p.getItems()) {
            PrescriptionItemDto d = new PrescriptionItemDto();
            d.setDrugName(i.getDrugName());
            d.setDosage(i.getDosage());
            d.setFrequency(i.getFrequency());
            d.setRoute(i.getRoute());
            d.setTiming(i.getTiming());
            d.setDuration(i.getDuration());
            d.setInstructions(i.getInstructions());
            r.getItems().add(d);
        }
        return r;
    }

    private String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return "system";
        }
        return auth.getPrincipal().toString();
    }
}
