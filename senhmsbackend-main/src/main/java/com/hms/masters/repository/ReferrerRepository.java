package com.hms.masters.repository;

import com.hms.masters.entity.Referrer;
import com.hms.masters.enums.ReferrerType;
import com.hms.masters.enums.Status;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReferrerRepository extends JpaRepository<Referrer, Long> {

    @Query("""
        SELECT r FROM Referrer r
        WHERE (:search IS NULL OR LOWER(r.name) LIKE LOWER(CONCAT('%',:search,'%'))
               OR r.phone LIKE CONCAT('%',:search,'%'))
        AND (:type IS NULL OR r.type = :type)
        AND (:status IS NULL OR r.status = :status)
    """)
    Page<Referrer> search(@Param("search") String search,
                          @Param("type") ReferrerType type,
                          @Param("status") Status status,
                          Pageable pageable);
}
