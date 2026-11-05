package com.hms.masters.repository;

import com.hms.masters.entity.IcdCode;
import com.hms.masters.enums.IcdCodeType;
import com.hms.masters.enums.Status;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface IcdCodeRepository extends JpaRepository<IcdCode, Long> {

    @Query("""
            SELECT i FROM IcdCode i
            WHERE (:search IS NULL OR LOWER(i.complaint)    LIKE LOWER(CONCAT('%', :search, '%'))
                                   OR LOWER(i.icdCode)      LIKE LOWER(CONCAT('%', :search, '%'))
                                   OR LOWER(i.description)  LIKE LOWER(CONCAT('%', :search, '%')))
              AND (:codeType IS NULL OR i.codeType = :codeType)
              AND (:status   IS NULL OR i.status   = :status)
            """)
    Page<IcdCode> search(
            @Param("search")   String search,
            @Param("codeType") IcdCodeType codeType,
            @Param("status")   Status status,
            Pageable pageable);

    /** Autocomplete — returns active codes matching query (used in case-sheet / billing). */
    @Query("""
            SELECT i FROM IcdCode i
            WHERE i.status = 'ACTIVE'
              AND (:codeType IS NULL OR i.codeType = :codeType)
              AND (LOWER(i.icdCode)   LIKE LOWER(CONCAT('%', :q, '%'))
                OR LOWER(i.complaint) LIKE LOWER(CONCAT('%', :q, '%')))
            ORDER BY i.icdCode
            """)
    List<IcdCode> autocomplete(
            @Param("q")        String q,
            @Param("codeType") IcdCodeType codeType,
            Pageable pageable);
}
