package com.hms.masters.repository;

import com.hms.masters.entity.InsuranceCompany;
import com.hms.masters.enums.Status;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface InsuranceCompanyRepository extends JpaRepository<InsuranceCompany, Long> {

    boolean existsByNameIgnoreCase(String name);
    List<InsuranceCompany> findByStatus(Status status);

    @Query("SELECT COALESCE(MAX(CAST(SUBSTRING(i.companyCode, 4) AS int)), 0) FROM InsuranceCompany i")
    Integer findMaxSequence();
}
