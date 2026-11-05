package com.hms.modules.patient.repository;

import com.hms.modules.patient.entity.Patient;
import com.hms.modules.patient.enums.PatientType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PatientRepository extends JpaRepository<Patient, Long> {

    Optional<Patient> findByUhid(String uhid);

    boolean existsByUhid(String uhid);

    boolean existsByPhone(String phone);

    /** Returns the first (oldest) patient record matching a phone number, used for duplicate detection. */
    Optional<Patient> findFirstByPhoneOrderByIdAsc(String phone);

    long countByFreePatientTrue();

    // ── UHID auto-generation ───────────────────────────────────────────────────
    /** Returns the max numeric suffix among UHIDs created on a specific date prefix. */
    @Query("""
        SELECT COALESCE(MAX(CAST(SUBSTRING(p.uhid, 16) AS int)), 0)
        FROM Patient p
        WHERE p.uhid LIKE CONCAT('UHID-', :datePrefix, '-%')
    """)
    Integer findMaxUhidSeqForDate(@Param("datePrefix") String datePrefix);

    // ── Paginated search ───────────────────────────────────────────────────────
    // patientTypes: when null/empty → no type filter; otherwise match any of the
    // supplied types (lets "In Patients" mean IP OR BOTH). dateFrom/dateTo are
    // inclusive LocalDateTime boundaries on p.createdAt (registration timestamp).
    @Query("""
        SELECT p FROM Patient p
        WHERE (:search IS NULL
               OR LOWER(p.name)  LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(p.uhid)  LIKE LOWER(CONCAT('%', :search, '%'))
               OR p.phone        LIKE CONCAT('%', :search, '%')
               OR LOWER(p.email) LIKE LOWER(CONCAT('%', :search, '%')))
        AND (:patientTypes IS NULL OR p.patientType IN :patientTypes)
        AND (:active IS NULL OR p.active = :active)
        AND (:dateFrom IS NULL OR p.createdAt >= :dateFrom)
        AND (:dateTo IS NULL OR p.createdAt <= :dateTo)
    """)
    Page<Patient> search(@Param("search")       String search,
                         @Param("patientTypes") List<PatientType> patientTypes,
                         @Param("active")       Boolean active,
                         @Param("dateFrom")      LocalDateTime dateFrom,
                         @Param("dateTo")        LocalDateTime dateTo,
                         Pageable pageable);

    // ── Counts by patient type (for the patient-list filter dropdown) ───────────
    // One grouped query → totals per type across the whole DB. Used so the filter
    // dropdown's "All (n) / Out Patients (n) / ..." counts stay accurate once the
    // list moved to server-side paging (the loaded page alone can't compute them).
    @Query("SELECT p.patientType, COUNT(p) FROM Patient p GROUP BY p.patientType")
    List<Object[]> countByType();
}
