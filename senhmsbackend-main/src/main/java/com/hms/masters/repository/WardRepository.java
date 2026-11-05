package com.hms.masters.repository;

import com.hms.masters.entity.Ward;
import com.hms.masters.enums.Status;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface WardRepository extends JpaRepository<Ward, Long> {

    List<Ward> findByStatus(Status status);
    List<Ward> findByDepartment_Id(Long departmentId);

    @Query("SELECT COALESCE(MAX(CAST(SUBSTRING(w.wardCode, 2) AS int)), 0) FROM Ward w")
    Integer findMaxSequence();
}
