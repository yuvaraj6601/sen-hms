package com.hms.modules.lab.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.util.Set;
import java.util.UUID;

/**
 * Stores and serves lab report files (PDFs and images) on the local filesystem.
 *
 * <p>Base directory is controlled by {@code app.upload.dir} (env var
 * {@code APP_UPLOAD_DIR}).  All files land in a {@code lab-reports/} sub-folder
 * so they are easy to back-up / volume-mount on Railway.
 *
 * <p>Files are addressed by a <em>relative path</em> (e.g.
 * {@code lab-reports/LAB-20260101-00001-report.pdf}) that is persisted on the
 * {@code LabInvestigation} row and later used to reconstruct the serve URL
 * ({@code /api/lab/files/<relative-path>}).
 */
@Slf4j
@Service
public class FileStorageService {

    private static final Set<String> ALLOWED_PDF_TYPES  = Set.of("application/pdf");
    private static final Set<String> ALLOWED_IMG_TYPES  = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif");
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "pdf", "jpg", "jpeg", "png", "webp", "gif");

    /** Max single-file size (20 MB) */
    private static final long MAX_FILE_BYTES = 20L * 1024 * 1024;

    private static final String SUB_DIR = "lab-reports";

    @Value("${app.upload.dir:/data}")
    private String uploadBaseDir;

    private Path labReportsDir;

    @PostConstruct
    public void init() {
        labReportsDir = Paths.get(uploadBaseDir).resolve(SUB_DIR).toAbsolutePath();
        try {
            Files.createDirectories(labReportsDir);
            log.info("[FILE-STORE] Lab reports directory ready: {}", labReportsDir);
        } catch (IOException e) {
            log.error("[FILE-STORE] Cannot create upload directory {}: {}", labReportsDir, e.getMessage());
            throw new IllegalStateException("Cannot create upload directory: " + labReportsDir, e);
        }
    }

    /**
     * Persists a multipart file and returns its <em>relative path</em>
     * (to be stored on the DB row).
     *
     * @param file     the uploaded file
     * @param labId    the lab investigation ID string (used as filename prefix)
     * @param fileType "pdf" | "image"
     * @return relative path such as {@code lab-reports/LAB-20260101-00001-report.pdf}
     */
    public String store(MultipartFile file, String labId, String fileType) {
        validateFile(file, fileType);

        String originalName  = StringUtils.cleanPath(file.getOriginalFilename() != null
                ? file.getOriginalFilename() : "upload");
        String ext           = extractExtension(originalName);
        String suffix        = "pdf".equals(fileType) ? "report" : "img-" + UUID.randomUUID().toString().substring(0, 8);
        String filename      = labId + "-" + suffix + "." + ext;

        Path targetPath = labReportsDir.resolve(filename);

        try (InputStream in = file.getInputStream()) {
            Files.copy(in, targetPath, StandardCopyOption.REPLACE_EXISTING);
            log.info("[FILE-STORE] Stored {} bytes → {}", file.getSize(), targetPath);
        } catch (IOException e) {
            log.error("[FILE-STORE] Failed to store file {}: {}", filename, e.getMessage());
            throw new RuntimeException("Failed to store file: " + e.getMessage(), e);
        }

        // Return relative path: "lab-reports/<filename>"
        return SUB_DIR + "/" + filename;
    }

    /**
     * Resolves a relative path to the absolute {@link Path} for streaming.
     * Performs a path-traversal check.
     */
    public Path resolve(String relativePath) {
        // Guard against path-traversal attacks (e.g. "../../etc/passwd")
        Path resolved = labReportsDir.resolve(Paths.get(relativePath).getFileName()).normalize();
        if (!resolved.startsWith(labReportsDir)) {
            throw new SecurityException("Path traversal attempt blocked: " + relativePath);
        }
        return resolved;
    }

    /**
     * Deletes a previously stored file. Silently ignores missing files.
     */
    public void delete(String relativePath) {
        if (!StringUtils.hasText(relativePath)) return;
        try {
            Path target = labReportsDir.resolve(Paths.get(relativePath).getFileName()).normalize();
            boolean deleted = Files.deleteIfExists(target);
            if (deleted) log.info("[FILE-STORE] Deleted {}", target);
        } catch (IOException e) {
            log.warn("[FILE-STORE] Could not delete {}: {}", relativePath, e.getMessage());
        }
    }

    // ── Validation ────────────────────────────────────────────────────────────

    private void validateFile(MultipartFile file, String fileType) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded file is empty");
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            throw new IllegalArgumentException(
                    "File exceeds maximum allowed size of 20 MB (uploaded: "
                    + (file.getSize() / (1024 * 1024)) + " MB)");
        }

        String ct  = file.getContentType() != null ? file.getContentType().toLowerCase() : "";
        String ext = extractExtension(
                StringUtils.cleanPath(file.getOriginalFilename() != null ? file.getOriginalFilename() : ""));

        if (!ALLOWED_EXTENSIONS.contains(ext)) {
            throw new IllegalArgumentException(
                    "File extension '" + ext + "' is not allowed. Allowed: pdf, jpg, jpeg, png, webp, gif");
        }

        if ("pdf".equals(fileType)) {
            if (!ALLOWED_PDF_TYPES.contains(ct) && !ext.equals("pdf")) {
                throw new IllegalArgumentException("Only PDF files are allowed for report uploads");
            }
        } else if ("image".equals(fileType)) {
            if (!ALLOWED_IMG_TYPES.contains(ct) && !Set.of("jpg", "jpeg", "png", "webp", "gif").contains(ext)) {
                throw new IllegalArgumentException("Only image files (jpg, png, webp, gif) are allowed");
            }
        }
    }

    private String extractExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return (dot >= 0 && dot < filename.length() - 1)
                ? filename.substring(dot + 1).toLowerCase()
                : "bin";
    }
}
