package com.hms.modules.appointment.repository;

import com.hms.modules.appointment.entity.Appointment;
import com.hms.modules.appointment.enums.AppointmentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface AppointmentRepository extends JpaRepository<Appointment, Long> {

    // ── Appointment number generation ──────────────────────────────────────────
    @Query("""
        SELECT COALESCE(MAX(CAST(SUBSTRING(a.appointmentNo, 16) AS int)), 0)
        FROM Appointment a
        WHERE a.appointmentNo LIKE CONCAT('APT-', :datePrefix, '-%')
    """)
    Integer findMaxAptSeqForDate(@Param("datePrefix") String datePrefix);

    // ── By patient / doctor ───────────────────────────────────────────────────
    List<Appointment> findByPatientIdOrderByDateDescTimeDesc(Long patientId);

    List<Appointment> findByDoctorIdAndDateOrderByTimeAsc(Long doctorId, LocalDate date);

    long countByDoctorIdAndDateAndStatus(Long doctorId, LocalDate date, AppointmentStatus status);

    // ── Today's appointments for a doctor (for dashboard) ────────────────────
    @Query("""
        SELECT a FROM Appointment a
        WHERE a.doctorId = :doctorId
        AND a.date = :date
        AND a.status NOT IN ('CANCELLED', 'NO_SHOW')
        ORDER BY a.time ASC
    """)
    List<Appointment> findTodayByDoctor(@Param("doctorId") Long doctorId,
                                        @Param("date") LocalDate date);

    // ── Paginated search ───────────────────────────────────────────────────────
    @Query("""
        SELECT a FROM Appointment a
        WHERE (:search IS NULL
               OR LOWER(a.patientName)    LIKE LOWER(CONCAT('%',:search,'%'))
               OR LOWER(a.uhid)           LIKE LOWER(CONCAT('%',:search,'%'))
               OR LOWER(a.appointmentNo)  LIKE LOWER(CONCAT('%',:search,'%'))
               OR a.phone                 LIKE CONCAT('%',:search,'%'))
        AND (:status          IS NULL OR a.status          = :status)
        AND (:doctorId        IS NULL OR a.doctorId        = :doctorId)
        AND (:department      IS NULL OR LOWER(a.department) = LOWER(:department))
        AND (:patientCategory IS NULL OR a.patientCategory = :patientCategory)
        AND (:date            IS NULL OR a.date            = :date)
        AND (:dateFrom        IS NULL OR a.date           >= :dateFrom)
        AND (:dateTo          IS NULL OR a.date           <= :dateTo)
    """)
    Page<Appointment> search(@Param("search")          String search,
                             @Param("status")          AppointmentStatus status,
                             @Param("doctorId")        Long doctorId,
                             @Param("department")      String department,
                             @Param("patientCategory") String patientCategory,
                             @Param("date")            LocalDate date,
                             @Param("dateFrom")        LocalDate dateFrom,
                             @Param("dateTo")          LocalDate dateTo,
                             Pageable pageable);

    long countByStatus(AppointmentStatus status);

    long countByDate(LocalDate date);

    // ── Slot conflict check (ignores CANCELLED / NO_SHOW / COMPLETED) ─────────
    @Query("""
        SELECT COUNT(a) > 0 FROM Appointment a
        WHERE a.doctorId = :doctorId
        AND a.date       = :date
        AND a.time       = :time
        AND a.status NOT IN (
            com.hms.modules.appointment.enums.AppointmentStatus.CANCELLED,
            com.hms.modules.appointment.enums.AppointmentStatus.NO_SHOW,
            com.hms.modules.appointment.enums.AppointmentStatus.COMPLETED
        )
    """)
    boolean existsActiveSlot(@Param("doctorId") Long doctorId,
                             @Param("date")     LocalDate date,
                             @Param("time")     String time);
}
