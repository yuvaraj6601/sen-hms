package com.hms.modules.pharmacy.repository;

import com.hms.modules.pharmacy.entity.PharmacyReturn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface PharmacyReturnRepository extends JpaRepository<PharmacyReturn, Long> {

    List<PharmacyReturn> findByEntryIdOrderByReturnDateAsc(Long entryId);

    @Query("SELECT COALESCE(SUM(r.returnAmount), 0) FROM PharmacyReturn r WHERE r.entry.id = :entryId")
    BigDecimal sumReturnedByEntryId(@Param("entryId") Long entryId);

    /** Distinct entry ids that had at least one return on the given date */
    @Query("SELECT DISTINCT r.entry.id FROM PharmacyReturn r WHERE r.returnDate = :date")
    List<Long> findEntryIdsWithReturnOn(@Param("date") LocalDate date);
}
