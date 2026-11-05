package com.hms.modules.discharge.repository;

import com.hms.modules.discharge.entity.DischargeSummary;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DischargeSummaryRepository extends JpaRepository<DischargeSummary, Long> {

    Optional<DischargeSummary> findByAdmissionId(Long admissionId);

    boolean existsByAdmissionId(Long admissionId);
}
