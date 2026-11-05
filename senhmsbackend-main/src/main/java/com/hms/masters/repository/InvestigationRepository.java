package com.hms.masters.repository;

import com.hms.masters.entity.Investigation;
import com.hms.masters.enums.Status;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface InvestigationRepository extends JpaRepository<Investigation, Long> {

    boolean existsByTestCode(String testCode);

    java.util.Optional<Investigation> findByTestCode(String testCode);

    List<Investigation> findByCategory(String category);
    List<Investigation> findByStatus(Status status);

    @Query("SELECT COALESCE(MAX(CAST(SUBSTRING(i.testCode, 4) AS int)), 0) FROM Investigation i")
    Integer findMaxSequence();

    // ── General search (used by InvestigationController) ──────────────────────
    @Query("""
        SELECT i FROM Investigation i
        WHERE (:search IS NULL OR LOWER(i.name) LIKE LOWER(CONCAT('%',:search,'%'))
               OR LOWER(i.category) LIKE LOWER(CONCAT('%',:search,'%'))
               OR LOWER(i.testCode) LIKE LOWER(CONCAT('%',:search,'%')))
        AND (:category IS NULL OR LOWER(i.category) = LOWER(:category))
        AND (:status IS NULL OR i.status = :status)
    """)
    Page<Investigation> search(@Param("search") String search,
                               @Param("category") String category,
                               @Param("status") Status status,
                               Pageable pageable);

    // ── Lab-master search with subcategory + sampleType filters ───────────────
    @Query("""
        SELECT i FROM Investigation i
        WHERE (:search IS NULL OR LOWER(i.name) LIKE LOWER(CONCAT('%',:search,'%'))
               OR LOWER(i.category) LIKE LOWER(CONCAT('%',:search,'%'))
               OR LOWER(i.testCode) LIKE LOWER(CONCAT('%',:search,'%')))
        AND (:category IS NULL OR LOWER(i.category) = LOWER(:category))
        AND (:subcategory IS NULL OR LOWER(i.subcategory) = LOWER(:subcategory))
        AND (:sampleType IS NULL OR LOWER(i.sampleType) = LOWER(:sampleType))
        AND (:status IS NULL OR i.status = :status)
    """)
    Page<Investigation> searchWithSample(@Param("search") String search,
                                         @Param("category") String category,
                                         @Param("subcategory") String subcategory,
                                         @Param("sampleType") String sampleType,
                                         @Param("status") Status status,
                                         Pageable pageable);

    // ── Dropdown seed queries ──────────────────────────────────────────────────

    @Query("SELECT DISTINCT i.unit FROM Investigation i WHERE i.unit IS NOT NULL AND i.unit <> '' ORDER BY i.unit")
    List<String> findDistinctUnits();

    @Query("""
        SELECT DISTINCT i.subcategory FROM Investigation i
        WHERE i.subcategory IS NOT NULL AND i.subcategory <> ''
        AND (:category IS NULL OR LOWER(i.category) = LOWER(:category))
        ORDER BY i.subcategory
    """)
    List<String> findDistinctSubcategories(@Param("category") String category);
}
