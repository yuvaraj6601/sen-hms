package com.hms.masters.repository;

import com.hms.masters.entity.BillingMaster;
import com.hms.masters.enums.Status;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface BillingMasterRepository extends JpaRepository<BillingMaster, Long> {

    boolean existsByServiceCode(String serviceCode);

    Optional<BillingMaster> findByServiceCode(String serviceCode);

    List<BillingMaster> findByServiceCodeIn(Collection<String> serviceCodes);

    List<BillingMaster> findByStatus(Status status);
    List<BillingMaster> findByModality_Id(Long modalityId);

    @Query("SELECT COALESCE(MAX(CAST(SUBSTRING(b.serviceCode, 4) AS int)), 0) FROM BillingMaster b")
    Integer findMaxSequence();

    @Query("""
        SELECT b FROM BillingMaster b JOIN b.modality m
        WHERE (:search IS NULL OR LOWER(b.serviceName) LIKE LOWER(CONCAT('%',:search,'%'))
               OR LOWER(b.serviceCode) LIKE LOWER(CONCAT('%',:search,'%')))
        AND (:modalityId IS NULL OR m.id = :modalityId)
        AND (:status IS NULL OR b.status = :status)
        AND (:showInOp IS NULL OR b.showInOp = :showInOp)
    """)
    Page<BillingMaster> search(@Param("search") String search,
                               @Param("modalityId") Long modalityId,
                               @Param("status") Status status,
                               @Param("showInOp") Boolean showInOp,
                               Pageable pageable);
}
