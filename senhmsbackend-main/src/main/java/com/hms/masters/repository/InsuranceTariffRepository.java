package com.hms.masters.repository;

import com.hms.masters.entity.InsuranceTariff;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface InsuranceTariffRepository extends JpaRepository<InsuranceTariff, Long> {

    /** All tariff rows for a given insurer — used to build the full price map on bill load */
    List<InsuranceTariff> findByInsuranceCompanyIdOrderByModalityNameAscServiceNameAsc(Long insuranceCompanyId);

    /** Single lookup: specific service for a specific insurer */
    Optional<InsuranceTariff> findByInsuranceCompanyIdAndServiceCode(Long insuranceCompanyId, String serviceCode);

    /** All tariff rows that share one insurer code (a price group) for a company */
    List<InsuranceTariff> findByInsuranceCompanyIdAndInsurerCode(Long insuranceCompanyId, String insurerCode);

    /** Check existence before upsert */
    boolean existsByInsuranceCompanyIdAndServiceCode(Long insuranceCompanyId, String serviceCode);

    /** Search within a company's tariff list — for the tariff management UI */
    @Query("""
        SELECT t FROM InsuranceTariff t
        WHERE t.insuranceCompanyId = :companyId
          AND (:search IS NULL
               OR LOWER(t.serviceName)   LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(t.serviceCode)   LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(t.modalityName)  LIKE LOWER(CONCAT('%', :search, '%')))
        ORDER BY t.modalityName ASC, t.serviceName ASC
    """)
    List<InsuranceTariff> search(
        @Param("companyId") Long companyId,
        @Param("search")    String search
    );
}
