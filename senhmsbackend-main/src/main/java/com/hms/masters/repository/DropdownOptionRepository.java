package com.hms.masters.repository;

import com.hms.masters.entity.DropdownOption;
import com.hms.masters.enums.DropdownCategory;
import com.hms.masters.enums.Status;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DropdownOptionRepository extends JpaRepository<DropdownOption, Long> {

    /** Paginated search within a category — used by the master list page. */
    @Query("""
            SELECT d FROM DropdownOption d
            WHERE d.category = :category
              AND (:search IS NULL OR LOWER(d.label) LIKE LOWER(CONCAT('%', :search, '%')))
              AND (:status IS NULL OR d.status = :status)
            """)
    Page<DropdownOption> search(
            @Param("category") DropdownCategory category,
            @Param("search")   String search,
            @Param("status")   Status status,
            Pageable pageable);

    /** Case-insensitive duplicate guard within a category. */
    boolean existsByCategoryAndLabelIgnoreCase(DropdownCategory category, String label);

    /** Case-insensitive lookup — used to make inline "+ Add" idempotent. */
    java.util.Optional<DropdownOption> findFirstByCategoryAndLabelIgnoreCase(
            DropdownCategory category, String label);

    /** For the duplicate guard on update (exclude the row being edited). */
    boolean existsByCategoryAndLabelIgnoreCaseAndIdNot(
            DropdownCategory category, String label, Long id);
}
