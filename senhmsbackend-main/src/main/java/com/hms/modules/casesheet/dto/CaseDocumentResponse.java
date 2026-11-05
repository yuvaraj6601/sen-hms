package com.hms.modules.casesheet.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CaseDocumentResponse {
    private Long id;
    private Long admissionId;
    private Long visitId;
    private String title;
    private String description;
    private String filePath;
    private String originalName;
    private String fileType;
    private Long fileSize;
    private String uploadedBy;
    private LocalDateTime createdAt;
}
