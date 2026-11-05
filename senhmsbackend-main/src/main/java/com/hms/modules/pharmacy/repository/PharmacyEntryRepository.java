package com.hms.modules.pharmacy.repository;

import com.hms.modules.pharmacy.entity.PharmacyEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface PharmacyEntryRepository extends JpaRepository<PharmacyEntry, Long> {

    List<PharmacyEntry> findByEntryDateOrderBySnoAsc(LocalDate date);

    int countByEntryDate(LocalDate date);

    boolean existsByEntryNo(String entryNo);

    @Query("SELECT COALESCE(MAX(CAST(SUBSTRING(e.entryNo, 5) AS int)), 0) FROM PharmacyEntry e")
    Integer findMaxSequence();

    @Query("""
        SELECT e FROM PharmacyEntry e
        WHERE e.entryDate >= :dateFrom AND e.entryDate <= :dateTo
        ORDER BY e.entryDate DESC, e.sno ASC
    """)
    List<PharmacyEntry> findByDateRange(@Param("dateFrom") LocalDate dateFrom,
                                        @Param("dateTo")   LocalDate dateTo);

    /** Case-insensitive name search, newest accounts first */
    @Query("""
        SELECT e FROM PharmacyEntry e
        WHERE LOWER(e.patientName) LIKE LOWER(CONCAT('%', :name, '%'))
        ORDER BY e.entryDate DESC, e.id DESC
    """)
    List<PharmacyEntry> searchByName(@Param("name") String name);

    List<PharmacyEntry> findByIdInOrderBySnoAsc(List<Long> ids);
}
