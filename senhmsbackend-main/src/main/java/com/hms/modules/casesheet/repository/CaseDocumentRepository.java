package com.hms.modules.casesheet.repository;

import com.hms.modules.casesheet.entity.CaseDocument;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CaseDocumentRepository extends JpaRepository<CaseDocument, Long> {

    List<CaseDocument> findByAdmissionIdOrderByCreatedAtDesc(Long admissionId);

    List<CaseDocument> findByVisitIdOrderByCreatedAtDesc(Long visitId);
}
