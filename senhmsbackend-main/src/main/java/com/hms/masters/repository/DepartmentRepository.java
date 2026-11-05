package com.hms.masters.repository;

import com.hms.masters.entity.Department;
import com.hms.masters.enums.Status;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface DepartmentRepository extends JpaRepository<Department, Long> {

    boolean existsByNameIgnoreCase(String name);
    boolean existsByShortNameIgnoreCase(String shortName);
    boolean existsByDeptCode(String deptCode);

    List<Department> findByStatus(Status status);
    List<Department> findByStatusOrderByName(Status status);

    Optional<Department> findByDeptCode(String deptCode);

    @Query("SELECT COALESCE(MAX(CAST(SUBSTRING(d.deptCode, 5) AS int)), 0) FROM Department d")
    Integer findMaxDeptCodeSequence();
}
