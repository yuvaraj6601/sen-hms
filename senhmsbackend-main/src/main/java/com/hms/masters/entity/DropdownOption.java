package com.hms.masters.entity;

import com.hms.common.BaseEntity;
import com.hms.masters.enums.DropdownCategory;
import com.hms.masters.enums.Status;
import jakarta.persistence.*;
import lombok.*;

/**
 * A single managed dropdown option (an Area, District, or Unit).
 *
 * All categories share this one table ({@code dropdown_options}), distinguished
 * by {@link #category}. The {@code (category, label)} pair is unique so the same
 * label can't be added twice within a category.
 */
@Entity
@Table(
        name = "dropdown_options",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_dropdown_category_label",
                columnNames = {"category", "label"})
)
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DropdownOption extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Which list this option belongs to: AREA / DISTRICT / UNIT. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DropdownCategory category;

    /** The visible value, e.g. "Anna Nagar", "Chennai", "mg/dL". */
    @Column(nullable = false, length = 150)
    private String label;

    /** Lower = shown first. Null sorts after numbered entries, then by label. */
    @Column(name = "display_order")
    private Integer displayOrder;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Status status = Status.ACTIVE;
}
