package com.hms.modules.casesheet.repository;

import com.hms.modules.casesheet.entity.Medication;
import com.hms.modules.casesheet.enums.MedicationStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MedicationRepository extends JpaRepository<Medication, Long> {

    List<Medication> findByPatientIdOrderByDateDescTimeDesc(Long patientId);

    List<Medication> findByAdmissionIdOrderByDateDescTimeDesc(Long admissionId);

    List<Medication> findByVisitIdOrderByDateDescTimeDesc(Long visitId);

    List<Medication> findByPatientIdAndStatusOrderByDateDescTimeDesc(Long patientId, MedicationStatus status);

    List<Medication> findByAdmissionIdAndStatusOrderByDateDescTimeDesc(Long admissionId, MedicationStatus status);
}
