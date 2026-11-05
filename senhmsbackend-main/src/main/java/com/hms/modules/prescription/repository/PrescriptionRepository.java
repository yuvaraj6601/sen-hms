package com.hms.modules.prescription.repository;

import com.hms.modules.prescription.entity.Prescription;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PrescriptionRepository extends JpaRepository<Prescription, Long> {

    @EntityGraph(attributePaths = "items")
    List<Prescription> findByAdmissionIdOrderByIdDesc(Long admissionId);

    @EntityGraph(attributePaths = "items")
    List<Prescription> findByVisitIdOrderByIdDesc(Long visitId);

    @EntityGraph(attributePaths = "items")
    List<Prescription> findByPatientIdOrderByIdDesc(String patientId);
}
