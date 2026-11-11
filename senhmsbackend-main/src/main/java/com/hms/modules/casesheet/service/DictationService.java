package com.hms.modules.casesheet.service;

import com.hms.modules.prescription.client.OpenAiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/** Hold-to-talk dictation for case-sheet fields: speech → plain text. Audio is not stored. */
@Slf4j
@Service
@RequiredArgsConstructor
public class DictationService {

    private static final long MAX_AUDIO_BYTES = 10L * 1024 * 1024;

    private final OpenAiClient openAi;

    public String transcribe(MultipartFile audio) {
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
        try {
            String text = openAi.transcribe(audio.getBytes(), audio.getOriginalFilename(), contentType);
            log.info("[DICTATION] transcribed sizeBytes={} chars={}", audio.getSize(), text == null ? 0 : text.length());
            return text == null ? "" : text.trim();
        } catch (IOException ex) {
            throw new IllegalArgumentException("Could not read the recording");
        }
    }
}
