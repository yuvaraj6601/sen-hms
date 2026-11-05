package com.hms.modules.prescription.client;

import com.hms.modules.prescription.dto.VoiceDraftResponse;

public interface OpenAiClient {

    /** Speech → text. */
    String transcribe(byte[] audio, String filename, String contentType);

    /** Transcript → structured prescription draft (transcript field left for the caller to set). */
    VoiceDraftResponse extractDraft(String transcript);
}
