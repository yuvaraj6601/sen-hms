package com.hms.modules.casesheet.repository;

import com.hms.modules.casesheet.entity.VitalSign;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VitalSignRepository extends JpaRepository<VitalSign, Long> {

    List<VitalSign> findByPatientIdOrderByRecordedAtDesc(Long patientId);

    List<VitalSign> findByAdmissionIdOrderByRecordedAtDesc(Long admissionId);

    List<VitalSign> findByVisitIdOrderByRecordedAtDesc(Long visitId);
}
