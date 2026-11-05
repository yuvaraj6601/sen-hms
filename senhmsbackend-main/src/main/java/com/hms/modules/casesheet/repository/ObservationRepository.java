package com.hms.modules.casesheet.repository;

import com.hms.modules.casesheet.entity.Observation;
import com.hms.modules.casesheet.enums.ObservationType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ObservationRepository extends JpaRepository<Observation, Long> {

    List<Observation> findByPatientIdOrderByDateDescTimeDesc(Long patientId);

    List<Observation> findByAdmissionIdOrderByDateDescTimeDesc(Long admissionId);

    List<Observation> findByVisitIdOrderByDateDescTimeDesc(Long visitId);

    List<Observation> findByPatientIdAndTypeOrderByDateDescTimeDesc(Long patientId, ObservationType type);
}
