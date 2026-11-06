package com.hms.modules.chatbot.entity;

import com.hms.common.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Maps the EXISTING {@code diet_rules} table (clinical safety rules per condition) — read only here. */
@Entity
@Table(name = "diet_rules")
@Getter @Setter @NoArgsConstructor
public class DietRule extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "condition_key", nullable = false, unique = true, length = 50)
    private String conditionKey;

    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    @Column(nullable = false)
    private boolean active;

    @Column(name = "dietician_approved", nullable = false)
    private boolean dieticianApproved;

    @Column(name = "low_gi", nullable = false)
    private boolean lowGi;

    @Column(name = "restrict_fluid", nullable = false)
    private boolean restrictFluid;

    @Column(name = "safety_priority", nullable = false)
    private int safetyPriority;

    @Column(name = "calorie_delta")
    private Integer calorieDelta;

    @Column(name = "sodium_max_mg")
    private Integer sodiumMaxMg;

    @Column(name = "potassium_max_mg")
    private Integer potassiumMaxMg;

    @Column(name = "phosphorus_max_mg")
    private Integer phosphorusMaxMg;

    @Column(name = "protein_max_g_per_kg")
    private Double proteinMaxGPerKg;

    @Column(name = "sat_fat_max_pct_kcal")
    private Double satFatMaxPctKcal;

    @Column(name = "forbidden_foods", columnDefinition = "TEXT")
    private String forbiddenFoods;

    @Column(name = "preferred_foods", columnDefinition = "TEXT")
    private String preferredFoods;

    @Column(name = "clinical_note", columnDefinition = "TEXT")
    private String clinicalNote;
}
