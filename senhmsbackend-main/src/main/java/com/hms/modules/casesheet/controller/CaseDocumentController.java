package com.hms.modules.casesheet.controller;

import com.hms.common.ApiResponse;
import com.hms.modules.casesheet.dto.CaseDocumentResponse;
import com.hms.modules.casesheet.service.CaseDocumentService;
import com.hms.modules.lab.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.PathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * Endpoints for case-sheet document uploads.
 *
 * Base path: /case-sheet/documents  (under Spring context /api)
 *
 * POST   /api/case-sheet/documents/upload        — upload a document
 * GET    /api/case-sheet/documents/admission/{id} — list for an admission
 * GET    /api/case-sheet/documents/visit/{id}     — list for an OP visit
 * DELETE /api/case-sheet/documents/{id}           — delete a document
 * GET    /api/case-sheet/documents/files/{name}   — download / stream file
 */
@Slf4j
@RestController
@RequestMapping("/case-sheet/documents")
@RequiredArgsConstructor
public class CaseDocumentController {

    private final CaseDocumentService service;
    private final FileStorageService fileStorageService;

    /** Upload a case document (multipart/form-data). */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<CaseDocumentResponse>> upload(
            @RequestParam(value = "admissionId", required = false) Long admissionId,
            @RequestParam(value = "visitId",     required = false) Long visitId,
            @RequestParam("title")                                  String title,
            @RequestParam(value = "description", defaultValue = "") String description,
            @RequestParam(value = "uploadedBy",  defaultValue = "") String uploadedBy,
            @RequestParam("file")                                   MultipartFile file) {
        log.info("[CASE-DOC] upload admissionId={} visitId={} title='{}' size={}",
                admissionId, visitId, title, file.getSize());
        return ResponseEntity.ok(ApiResponse.ok("Document uploaded",
                service.upload(admissionId, visitId, title, description, uploadedBy, file)));
    }

    /** All documents for an admission. */
    @GetMapping("/admission/{admissionId}")
    public ResponseEntity<ApiResponse<List<CaseDocumentResponse>>> byAdmission(
            @PathVariable Long admissionId) {
        return ResponseEntity.ok(ApiResponse.ok(service.getByAdmission(admissionId)));
    }

    /** All documents for an OP visit. */
    @GetMapping("/visit/{visitId}")
    public ResponseEntity<ApiResponse<List<CaseDocumentResponse>>> byVisit(
            @PathVariable Long visitId) {
        return ResponseEntity.ok(ApiResponse.ok(service.getByVisit(visitId)));
    }

    /** Delete a document (and its stored file). */
    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("Document deleted", null));
    }

    /** Download / stream a stored file by filename. */
    @GetMapping(value = "/files/{filename:.+}")
    public ResponseEntity<Resource> serveFile(@PathVariable String filename) {
        Path filePath = fileStorageService.resolve("lab-reports/" + filename);
        Resource resource = new PathResource(filePath);

        if (!resource.exists() || !resource.isReadable()) {
            return ResponseEntity.notFound().build();
        }

        String contentType;
        try {
            contentType = Files.probeContentType(filePath);
        } catch (IOException e) {
            contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;
        }
        if (contentType == null) contentType = MediaType.APPLICATION_OCTET_STREAM_VALUE;

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + filePath.getFileName() + "\"")
                .contentType(MediaType.parseMediaType(contentType))
                .body(resource);
    }
}
