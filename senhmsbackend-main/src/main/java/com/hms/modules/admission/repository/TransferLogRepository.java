package com.hms.modules.admission.repository;

import com.hms.modules.admission.entity.TransferLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TransferLogRepository extends JpaRepository<TransferLog, Long> {

    List<TransferLog> findByAdmissionIdOrderByTransferDateDescTransferTimeDesc(Long admissionId);

    @Query("""
        SELECT COALESCE(MAX(CAST(SUBSTRING(t.transferNo, 16) AS int)), 0)
        FROM TransferLog t
        WHERE t.transferNo LIKE CONCAT('TRF-', :datePrefix, '-%')
    """)
    Integer findMaxTransferSeqForDate(@Param("datePrefix") String datePrefix);
}
