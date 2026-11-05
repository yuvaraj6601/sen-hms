package com.hms.modules.feedback.repository;

import com.hms.modules.feedback.entity.Feedback;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface FeedbackRepository extends JpaRepository<Feedback, Long> {

    /**
     * Paginated search over name / mobile with an optional createdAt range.
     * A null search term matches all; null date bounds are ignored.
     */
    @Query("""
            SELECT f FROM Feedback f
            WHERE (:search IS NULL
                   OR LOWER(f.name)   LIKE LOWER(CONCAT('%', :search, '%'))
                   OR f.mobile        LIKE CONCAT('%', :search, '%'))
              AND (:from IS NULL OR f.createdAt >= :from)
              AND (:to   IS NULL OR f.createdAt <= :to)
            """)
    Page<Feedback> search(@Param("search") String search,
                          @Param("from") LocalDateTime from,
                          @Param("to") LocalDateTime to,
                          Pageable pageable);
}
