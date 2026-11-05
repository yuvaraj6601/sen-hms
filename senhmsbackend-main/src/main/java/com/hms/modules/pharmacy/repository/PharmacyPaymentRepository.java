package com.hms.modules.pharmacy.repository;

import com.hms.modules.pharmacy.entity.PharmacyPayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface PharmacyPaymentRepository extends JpaRepository<PharmacyPayment, Long> {

    List<PharmacyPayment> findByEntryIdOrderByPaymentDateAscIdAsc(Long entryId);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM PharmacyPayment p WHERE p.entry.id = :entryId")
    BigDecimal sumPaidByEntryId(@Param("entryId") Long entryId);

    /** Distinct entry ids that had at least one payment on the given date */
    @Query("SELECT DISTINCT p.entry.id FROM PharmacyPayment p WHERE p.paymentDate = :date")
    List<Long> findEntryIdsWithPaymentOn(@Param("date") LocalDate date);
}
