package com.hms.modules.casesheet.entity;

import com.hms.common.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

/**
 * A clinical document (PDF or image) uploaded against an admission or OP visit.
 *
 * <p>Examples: outsourced CT report, X-ray scan, external blood report PDF,
 * specialist referral letter, consent form scan.
 *
 * <p>Files are stored on disk by {@link com.hms.modules.lab.service.FileStorageService}
 * (reused — it stores under the same {@code lab-reports/} folder; the path is
 * what distinguishes them). A separate sub-folder can be introduced later.
 */
@Entity
@Table(name = "case_documents", indexes = {
    @Index(name = "idx_case_doc_admission", columnList = "admission_id"),
    @Index(name = "idx_case_doc_visit",     columnList = "visit_id"),
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CaseDocument extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Linked admission (IP). Null for OP-only documents. */
    @Column(name = "admission_id")
    private Long admissionId;

    /** Linked OP visit. Null for IP documents. */
    @Column(name = "visit_id")
    private Long visitId;

    /** Short label shown in the document list, e.g. "Chest X-Ray". */
    @Column(nullable = false, length = 200)
    private String title;

    /** Optional free-text notes, e.g. "PA view, taken 15 Feb 2026". */
    @Column(columnDefinition = "TEXT")
    private String description;

    /**
     * Server-relative file path, e.g. {@code lab-reports/CASE-DOC-42.pdf}.
     * Used to construct the download URL.
     */
    @Column(name = "file_path", nullable = false, length = 500)
    private String filePath;

    /** Original filename as uploaded (for display / download name). */
    @Column(name = "original_name", length = 255)
    private String originalName;

    /** MIME type, e.g. "application/pdf" or "image/jpeg". */
    @Column(name = "file_type", length = 100)
    private String fileType;

    /** File size in bytes. */
    @Column(name = "file_size")
    private Long fileSize;

    /** Who uploaded the document. */
    @Column(name = "uploaded_by", length = 150)
    private String uploadedBy;
}
