package com.hms.masters.repository;

import com.hms.masters.entity.BillingModality;
import com.hms.masters.enums.Status;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface BillingModalityRepository extends JpaRepository<BillingModality, Long> {

    boolean existsByNameIgnoreCase(String name);
    boolean existsByShortNameIgnoreCase(String shortName);
    List<BillingModality> findByStatus(Status status);

    @Query("SELECT COALESCE(MAX(CAST(SUBSTRING(m.modalityCode, 4) AS int)), 0) FROM BillingModality m")
    Integer findMaxSequence();
}
