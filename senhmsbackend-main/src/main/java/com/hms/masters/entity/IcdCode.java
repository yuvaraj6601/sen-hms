package com.hms.masters.entity;

import com.hms.common.BaseEntity;
import com.hms.masters.enums.IcdCodeType;
import com.hms.masters.enums.Status;
import jakarta.persistence.*;
import lombok.*;

/**
 * ICD / PCS Code master.
 *
 * Stores both ICD-10-CM (diagnosis) and ICD-10-PCS (procedure) codes.
 * Used for insurance claim coding and clinical documentation.
 *
 * Fields visible on the form:
 *   - complaint    : Chief complaint / clinical term (e.g. "Chest Pain")
 *   - icdCode      : ICD-10-CM or PCS code (e.g. "R07.9")
 *   - description  : Full clinical description from ICD codebook
 *   - codeType     : ICD_10_CM (diagnosis) | ICD_10_PCS (procedure)
 */
@Entity
@Table(name = "icd_codes")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IcdCode extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Chief complaint / clinical entry point (e.g. "Acute Chest Pain") */
    @Column(nullable = false, length = 200)
    private String complaint;

    /** ICD-10-CM or ICD-10-PCS code (e.g. "I21.0", "0210093") */
    @Column(name = "icd_code", nullable = false, length = 20)
    private String icdCode;

    /** Full clinical description from the ICD codebook */
    @Column(nullable = false, length = 500)
    private String description;

    /** ICD_10_CM = diagnosis code, ICD_10_PCS = procedure code */
    @Enumerated(EnumType.STRING)
    @Column(name = "code_type", nullable = false, length = 15)
    private IcdCodeType codeType = IcdCodeType.ICD_10_CM;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Status status = Status.ACTIVE;
}
