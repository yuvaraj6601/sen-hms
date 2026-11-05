package com.hms.modules.casesheet.service;

import com.hms.common.AuditLogService;
import com.hms.exception.ResourceNotFoundException;
import com.hms.modules.casesheet.dto.CaseDocumentResponse;
import com.hms.modules.casesheet.entity.CaseDocument;
import com.hms.modules.casesheet.repository.CaseDocumentRepository;
import com.hms.modules.lab.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class CaseDocumentService {

    private final CaseDocumentRepository repo;
    private final FileStorageService fileStorageService;
    private final AuditLogService auditLogService;

    /**
     * Upload and persist a case document.
     *
     * @param admissionId linked admission (null for OP visits)
     * @param visitId     linked OP visit (null for admissions)
     * @param title       document label (required)
     * @param description optional notes
     * @param uploadedBy  logged-in user name
     * @param file        the multipart file
     */
    public CaseDocumentResponse upload(Long admissionId, Long visitId,
                                       String title, String description,
                                       String uploadedBy, MultipartFile file) {
        if (!StringUtils.hasText(title)) {
            throw new IllegalArgumentException("Document title is required");
        }
        if (admissionId == null && visitId == null) {
            throw new IllegalArgumentException("Either admissionId or visitId is required");
        }

        // Derive a fileType label ("pdf" or "image") for storage naming
        String ct       = file.getContentType() != null ? file.getContentType().toLowerCase() : "";
        String fileKind = ct.contains("pdf") ? "pdf" : "image";

        // Reuse the lab FileStorageService — files go into lab-reports/ folder.
        // The "labId"-style prefix here is "CASE-DOC" + admissionId/visitId for uniqueness.
        String prefix      = "CASE-DOC-" + (admissionId != null ? "ADM" + admissionId : "VISIT" + visitId);
        String relativePath = fileStorageService.store(file, prefix, fileKind);

        CaseDocument doc = CaseDocument.builder()
                .admissionId(admissionId)
                .visitId(visitId)
                .title(title.trim())
                .description(StringUtils.hasText(description) ? description.trim() : null)
                .filePath(relativePath)
                .originalName(file.getOriginalFilename())
                .fileType(file.getContentType())
                .fileSize(file.getSize())
                .uploadedBy(StringUtils.hasText(uploadedBy) ? uploadedBy : currentUser())
                .build();

        CaseDocument saved = repo.save(doc);
        log.info("[CASE-DOC] uploaded id={} title='{}' admissionId={} visitId={}",
                saved.getId(), saved.getTitle(), admissionId, visitId);
        auditLogService.log("CaseDocument", saved.getId(), "UPLOADED", currentUser(),
                "title=" + saved.getTitle());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<CaseDocumentResponse> getByAdmission(Long admissionId) {
        return repo.findByAdmissionIdOrderByCreatedAtDesc(admissionId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<CaseDocumentResponse> getByVisit(Long visitId) {
        return repo.findByVisitIdOrderByCreatedAtDesc(visitId)
                .stream().map(this::toResponse).toList();
    }

    public void delete(Long id) {
        CaseDocument doc = repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Case document", id));
        fileStorageService.delete(doc.getFilePath());
        repo.delete(doc);
        log.info("[CASE-DOC] deleted id={} title='{}'", id, doc.getTitle());
        auditLogService.log("CaseDocument", id, "DELETED", currentUser(),
                "title=" + doc.getTitle());
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private CaseDocumentResponse toResponse(CaseDocument d) {
        CaseDocumentResponse r = new CaseDocumentResponse();
        r.setId(d.getId());
        r.setAdmissionId(d.getAdmissionId());
        r.setVisitId(d.getVisitId());
        r.setTitle(d.getTitle());
        r.setDescription(d.getDescription());
        r.setFilePath(d.getFilePath());
        r.setOriginalName(d.getOriginalName());
        r.setFileType(d.getFileType());
        r.setFileSize(d.getFileSize());
        r.setUploadedBy(d.getUploadedBy());
        r.setCreatedAt(d.getCreatedAt());
        return r;
    }

    private String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()
                || "anonymousUser".equals(auth.getPrincipal())) return "system";
        return auth.getPrincipal().toString();
    }
}
