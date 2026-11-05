package com.hms.masters.repository;

import com.hms.masters.entity.Doctor;
import com.hms.masters.enums.DoctorStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface DoctorRepository extends JpaRepository<Doctor, Long> {

    boolean existsByRegistrationNoIgnoreCase(String registrationNo);
    boolean existsByEmailIgnoreCase(String email);

    List<Doctor> findByStatus(DoctorStatus status);

    @Query("""
        SELECT d FROM Doctor d
        WHERE (:status IS NULL OR d.status = :status)
        AND (:deptId IS NULL OR d.department.id = :deptId)
        AND (:search IS NULL OR LOWER(d.name) LIKE LOWER(CONCAT('%', :search, '%'))
             OR LOWER(d.specializations) LIKE LOWER(CONCAT('%', :search, '%'))
             OR d.phone LIKE CONCAT('%', :search, '%'))
    """)
    Page<Doctor> searchDoctors(@Param("search") String search,
                               @Param("status") DoctorStatus status,
                               @Param("deptId") Long deptId,
                               Pageable pageable);

    @Query("SELECT d FROM Doctor d WHERE d.illnessTags LIKE CONCAT('%', :tag, '%') AND d.status = 'ACTIVE'")
    List<Doctor> findByIllnessTag(@Param("tag") String tag);
}
