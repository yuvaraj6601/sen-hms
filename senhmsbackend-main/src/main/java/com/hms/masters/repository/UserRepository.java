package com.hms.masters.repository;

import com.hms.masters.entity.User;
import com.hms.masters.enums.Status;
import com.hms.masters.enums.UserRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    boolean existsByEmailIgnoreCase(String email);
    boolean existsByEmployeeId(String employeeId);
    Optional<User> findByEmailIgnoreCase(String email);

    /** Batch lookup used to resolve audit-log performer emails to display names. */
    java.util.List<User> findByEmailIgnoreCaseIn(java.util.Collection<String> emails);

    @Query("""
        SELECT u FROM User u
        WHERE (:search IS NULL OR LOWER(u.name) LIKE LOWER(CONCAT('%',:search,'%'))
               OR LOWER(u.email) LIKE LOWER(CONCAT('%',:search,'%'))
               OR u.phone LIKE CONCAT('%',:search,'%'))
        AND (:role IS NULL OR u.role = :role)
        AND (:status IS NULL OR u.status = :status)
    """)
    Page<User> search(@Param("search") String search,
                      @Param("role") UserRole role,
                      @Param("status") Status status,
                      Pageable pageable);

    /**
     * Highest numeric sequence used in employee_id for a given role.
     * Native MySQL query: JPQL's CAST(... AS int) emits an invalid target type
     * for MySQL (which needs SIGNED/UNSIGNED), silently yielding 0 and causing
     * duplicate employee_id collisions. SUBSTRING(employee_id, 5) drops the
     * "RCP-" style prefix; role is bound as its enum name string.
     */
    @Query(value = "SELECT COALESCE(MAX(CAST(SUBSTRING(employee_id, 5) AS UNSIGNED)), 0) "
                 + "FROM users WHERE role = :role", nativeQuery = true)
    Integer findMaxSeqForRole(@Param("role") String role);
}
