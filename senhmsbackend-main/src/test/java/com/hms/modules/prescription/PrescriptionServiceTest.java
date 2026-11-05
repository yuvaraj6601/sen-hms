package com.hms.modules.prescription;

import com.hms.common.AuditLogService;
import com.hms.exception.ResourceNotFoundException;
import com.hms.modules.admission.entity.Admission;
import com.hms.modules.admission.enums.AdmissionStatus;
import com.hms.modules.admission.repository.AdmissionRepository;
import com.hms.modules.casesheet.enums.MedicationRoute;
import com.hms.modules.patient.entity.Patient;
import com.hms.modules.patient.repository.PatientRepository;
import com.hms.modules.prescription.client.OpenAiClient;
import com.hms.modules.prescription.dto.PrescriptionItemDto;
import com.hms.modules.prescription.dto.PrescriptionRequest;
import com.hms.modules.prescription.dto.PrescriptionResponse;
import com.hms.modules.prescription.dto.VoiceDraftResponse;
import com.hms.modules.prescription.entity.Prescription;
import com.hms.modules.prescription.enums.PrescriptionSource;
import com.hms.modules.prescription.enums.PrescriptionTiming;
import com.hms.modules.prescription.repository.PrescriptionRepository;
import com.hms.modules.prescription.service.PrescriptionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PrescriptionServiceTest {

    @Mock PrescriptionRepository repo;
    @Mock PatientRepository patientRepo;
    @Mock AdmissionRepository admissionRepo;
    @Mock OpenAiClient openAi;
    @Mock AuditLogService audit;

    PrescriptionService service;

    @BeforeEach
    void setUp() {
        service = new PrescriptionService(repo, patientRepo, admissionRepo, openAi, audit);
    }

    // ── helpers ──────────────────────────────────────────────
    private MockMultipartFile audio(byte[] bytes, String contentType) {
        return new MockMultipartFile("audio", "dictation.webm", contentType, bytes);
    }

    private PrescriptionItemDto item(String drug) {
        PrescriptionItemDto i = new PrescriptionItemDto();
        i.setDrugName(drug);
        i.setDosage("500mg");
        i.setFrequency("1-0-1");
        i.setRoute(MedicationRoute.ORAL);
        i.setTiming(PrescriptionTiming.AFTER_FOOD);
        i.setDuration("5 days");
        return i;
    }

    private PrescriptionRequest request(Long admissionId, List<PrescriptionItemDto> items) {
        PrescriptionRequest r = new PrescriptionRequest();
        r.setPatientId(1L);
        r.setUhid("UH001");
        r.setAdmissionId(admissionId);
        r.setDoctorName("Dr. Ravi");
        r.setDiagnosis("Viral fever");
        r.setSource(PrescriptionSource.VOICE);
        r.setVoiceTranscript("tab paracetamol 500 twice daily after food for 5 days");
        r.setItems(items);
        return r;
    }

    private Patient patient() {
        Patient p = new Patient();
        p.setId(1L);
        p.setUhid("UH001");
        p.setName("Test Patient");
        p.setAge(40);
        return p;
    }

    // ═════════════ createVoiceDraft ═════════════

    @Test
    void createVoiceDraft_happyPath_returnsTranscriptAndStructuredDraft() {
        byte[] bytes = new byte[]{1, 2, 3};
        VoiceDraftResponse extracted = new VoiceDraftResponse();
        extracted.setDiagnosis("Viral fever");
        extracted.setItems(List.of(item("Paracetamol")));
        when(openAi.transcribe(any(), anyString(), anyString())).thenReturn("tab paracetamol 500 twice daily");
        when(openAi.extractDraft("tab paracetamol 500 twice daily")).thenReturn(extracted);

        VoiceDraftResponse out = service.createVoiceDraft(audio(bytes, "audio/webm"));

        assertThat(out.getTranscript()).isEqualTo("tab paracetamol 500 twice daily");
        assertThat(out.getDiagnosis()).isEqualTo("Viral fever");
        assertThat(out.getItems()).hasSize(1);
        verify(repo, never()).save(any());   // a draft is NEVER persisted
    }

    @Test
    void createVoiceDraft_nullAudio_throwsIllegalArgument() {
        assertThatThrownBy(() -> service.createVoiceDraft(null))
                .isInstanceOf(IllegalArgumentException.class);
        verify(openAi, never()).transcribe(any(), anyString(), anyString());
    }

    @Test
    void createVoiceDraft_emptyAudio_throwsIllegalArgument() {
        assertThatThrownBy(() -> service.createVoiceDraft(audio(new byte[0], "audio/webm")))
                .isInstanceOf(IllegalArgumentException.class);
        verify(openAi, never()).transcribe(any(), anyString(), anyString());
    }

    @Test
    void createVoiceDraft_nonAudioContentType_throwsIllegalArgument() {
        assertThatThrownBy(() -> service.createVoiceDraft(audio(new byte[]{1}, "application/pdf")))
                .isInstanceOf(IllegalArgumentException.class);
        verify(openAi, never()).transcribe(any(), anyString(), anyString());
    }

    @Test
    void createVoiceDraft_audioOverTenMb_throwsIllegalArgument() {
        byte[] tooBig = new byte[10 * 1024 * 1024 + 1];
        assertThatThrownBy(() -> service.createVoiceDraft(audio(tooBig, "audio/webm")))
                .isInstanceOf(IllegalArgumentException.class);
        verify(openAi, never()).transcribe(any(), anyString(), anyString());
    }

    @Test
    void createVoiceDraft_exactlyTenMb_isAccepted() {
        byte[] max = new byte[10 * 1024 * 1024];
        when(openAi.transcribe(any(), anyString(), anyString())).thenReturn("hello");
        when(openAi.extractDraft("hello")).thenReturn(new VoiceDraftResponse());

        assertThat(service.createVoiceDraft(audio(max, "audio/webm"))).isNotNull();
    }

    @Test
    void createVoiceDraft_blankTranscript_throwsIllegalArgumentAndSkipsExtraction() {
        when(openAi.transcribe(any(), anyString(), anyString())).thenReturn("   ");

        assertThatThrownBy(() -> service.createVoiceDraft(audio(new byte[]{1}, "audio/webm")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("speech");
        verify(openAi, never()).extractDraft(anyString());
    }

    @Test
    void createVoiceDraft_extractionReturnsNoItems_stillReturnsDraftWithEmptyItems() {
        when(openAi.transcribe(any(), anyString(), anyString())).thenReturn("patient has cough");
        VoiceDraftResponse extracted = new VoiceDraftResponse();
        extracted.setItems(null);
        when(openAi.extractDraft("patient has cough")).thenReturn(extracted);

        VoiceDraftResponse out = service.createVoiceDraft(audio(new byte[]{1}, "audio/webm"));

        assertThat(out.getItems()).isNotNull().isEmpty();
        assertThat(out.getTranscript()).isEqualTo("patient has cough");
    }

    // ═════════════ save ═════════════

    @Test
    void save_happyPath_persistsPrescriptionWithOrderedItemsAndVoiceMetadata() {
        when(patientRepo.findById(1L)).thenReturn(Optional.of(patient()));
        when(repo.save(any(Prescription.class))).thenAnswer(inv -> {
            Prescription p = inv.getArgument(0);
            p.setId(10L);
            return p;
        });

        PrescriptionResponse out = service.save(request(null, List.of(item("Paracetamol"), item("Pantoprazole"))));

        ArgumentCaptor<Prescription> cap = ArgumentCaptor.forClass(Prescription.class);
        verify(repo).save(cap.capture());
        Prescription saved = cap.getValue();
        assertThat(saved.getPatientName()).isEqualTo("Test Patient");   // taken from DB, not client
        assertThat(saved.getSource()).isEqualTo(PrescriptionSource.VOICE);
        assertThat(saved.getVoiceTranscript()).contains("paracetamol");
        assertThat(saved.getPrescriptionNo()).isNotBlank();
        assertThat(saved.getItems()).hasSize(2);
        assertThat(saved.getItems().get(0).getSortOrder()).isEqualTo(0);
        assertThat(saved.getItems().get(1).getSortOrder()).isEqualTo(1);
        assertThat(saved.getItems().get(1).getDrugName()).isEqualTo("Pantoprazole");
        assertThat(out.getId()).isEqualTo(10L);
        verify(audit).log(anyString(), any(), anyString(), anyString(), anyString());
    }

    @Test
    void save_manualSource_doesNotStoreTranscript() {
        when(patientRepo.findById(1L)).thenReturn(Optional.of(patient()));
        when(repo.save(any(Prescription.class))).thenAnswer(inv -> inv.getArgument(0));
        PrescriptionRequest r = request(null, List.of(item("Paracetamol")));
        r.setSource(PrescriptionSource.MANUAL);
        r.setVoiceTranscript("should be ignored");

        service.save(r);

        ArgumentCaptor<Prescription> cap = ArgumentCaptor.forClass(Prescription.class);
        verify(repo).save(cap.capture());
        assertThat(cap.getValue().getSource()).isEqualTo(PrescriptionSource.MANUAL);
        assertThat(cap.getValue().getVoiceTranscript()).isNull();
    }

    @Test
    void save_unknownPatient_throwsResourceNotFound() {
        when(patientRepo.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.save(request(null, List.of(item("Paracetamol")))))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(repo, never()).save(any());
    }

    @Test
    void save_unknownAdmission_throwsResourceNotFound() {
        when(patientRepo.findById(1L)).thenReturn(Optional.of(patient()));
        when(admissionRepo.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.save(request(99L, List.of(item("Paracetamol")))))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(repo, never()).save(any());
    }

    @Test
    void save_dischargedAdmission_throwsIllegalState() {
        Admission discharged = new Admission();
        discharged.setId(5L);
        discharged.setStatus(AdmissionStatus.DISCHARGED);
        when(patientRepo.findById(1L)).thenReturn(Optional.of(patient()));
        when(admissionRepo.findById(5L)).thenReturn(Optional.of(discharged));

        assertThatThrownBy(() -> service.save(request(5L, List.of(item("Paracetamol")))))
                .isInstanceOf(IllegalStateException.class);
        verify(repo, never()).save(any());
    }

    @Test
    void save_noItems_throwsIllegalArgument() {
        assertThatThrownBy(() -> service.save(request(null, List.of())))
                .isInstanceOf(IllegalArgumentException.class);
        verify(repo, never()).save(any());
    }

    // ═════════════ list ═════════════

    @Test
    void list_byAdmission_usesAdmissionQueryNewestFirst() {
        Prescription p = new Prescription();
        p.setId(1L);
        when(repo.findByAdmissionIdOrderByIdDesc(7L)).thenReturn(List.of(p));

        List<PrescriptionResponse> out = service.list(null, 7L, null);

        assertThat(out).hasSize(1);
        verify(repo).findByAdmissionIdOrderByIdDesc(7L);
    }

    @Test
    void list_noFilter_throwsIllegalArgument() {
        assertThatThrownBy(() -> service.list(null, null, null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
