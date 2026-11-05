package com.hms.modules.prescription.entity;

import com.hms.modules.casesheet.enums.MedicationRoute;
import com.hms.modules.prescription.enums.PrescriptionTiming;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Maps the EXISTING {@code prescription_items} table — no schema changes. */
@Entity
@Table(name = "prescription_items")
@Getter @Setter @NoArgsConstructor
public class PrescriptionItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "prescription_id", nullable = false)
    private Prescription prescription;

    @Column(name = "drug_name", nullable = false, length = 200)
    private String drugName;

    @Column(nullable = false, length = 100)
    private String dosage;

    @Column(nullable = false, length = 100)
    private String frequency;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MedicationRoute route = MedicationRoute.ORAL;

    @Enumerated(EnumType.STRING)
    private PrescriptionTiming timing;

    @Column(length = 100)
    private String duration;

    @Column(columnDefinition = "TEXT")
    private String instructions;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;
}
