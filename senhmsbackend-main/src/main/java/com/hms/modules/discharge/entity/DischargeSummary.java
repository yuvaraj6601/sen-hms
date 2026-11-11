package com.hms.modules.discharge.entity;

import com.hms.common.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

/**
 * Stores the full clinical discharge summary for an IP admission.
 *
 * Sections (matching Sen Hospital's printed format):
 *   1. Patient / Admission header
 *   2. Final diagnosis
 *   3. Chief complaints
 *   4. History of present illness
 *   5. Past history
 *   6. Clinical examination
 *   7. Investigations summary
 *   8. Pulmonary function test (optional)
 *   9. Hospital course
 *  10. Medications / treatment given in hospital
 *  11. Condition at discharge
 *  12. Discharge medication
 *  13. Discharge advice
 *  14. Follow-up
 *  15. Consultant signature name
 */
@Entity
@Table(name = "discharge_summary")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DischargeSummary extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ── Links ─────────────────────────────────────────────────────────────────

    @Column(name = "admission_id", nullable = false, unique = true)
    private Long admissionId;

    @Column(name = "admission_no", nullable = false, length = 25)
    private String admissionNo;

    @Column(name = "patient_id", nullable = false)
    private Long patientId;

    @Column(name = "uhid", nullable = false, length = 25)
    private String uhid;

    // ── Patient / Admission header ────────────────────────────────────────────

    @Column(name = "patient_name", length = 150)
    private String patientName;

    @Column(name = "age_sex", length = 30)
    private String ageSex;                // e.g. "18 Years / Male"

    @Column(name = "ip_no", length = 30)
    private String ipNo;                  // IP No as shown on the slip

    @Column(name = "room_no", length = 100)
    private String roomNo;

    @Column(name = "consultant_name", length = 150)
    private String consultantName;

    @Column(name = "insurance_name", length = 150)
    private String insuranceName;         // Insurance company name if applicable

    @Column(name = "claim_no", length = 80)
    private String claimNo;               // e.g. CIR/2027/121300/0873124

    @Column(name = "date_of_admission")
    private LocalDate dateOfAdmission;

    @Column(name = "time_of_admission", length = 10)
    private String timeOfAdmission;       // "10:45 PM"

    @Column(name = "date_of_discharge")
    private LocalDate dateOfDischarge;

    @Column(name = "time_of_discharge", length = 10)
    private String timeOfDischarge;       // "03:45 PM"

    // ── 1. Final diagnosis ────────────────────────────────────────────────────

    @Column(name = "final_diagnosis", columnDefinition = "TEXT")
    private String finalDiagnosis;

    // ── 2. Chief complaints ───────────────────────────────────────────────────

    @Column(name = "chief_complaints", columnDefinition = "TEXT")
    private String chiefComplaints;

    // ── 3. History of present illness ─────────────────────────────────────────

    @Column(name = "history_of_present_illness", columnDefinition = "TEXT")
    private String historyOfPresentIllness;

    // ── 4. Past history ────────────────────────────────────────────────────────

    @Column(name = "past_history", columnDefinition = "TEXT")
    private String pastHistory;           // Diabetes, Hypertension, CAD, Asthma, Drug allergy etc.

    // ── 5. Clinical examination ────────────────────────────────────────────────

    @Column(name = "clinical_examination", columnDefinition = "TEXT")
    private String clinicalExamination;   // CVS, RS, Abdomen, CNS, Hydration etc.

    // ── 6. Investigations summary ─────────────────────────────────────────────

    @Column(name = "investigations", columnDefinition = "TEXT")
    private String investigations;

    // ── 7. Pulmonary function test (optional) ─────────────────────────────────

    @Column(name = "pulmonary_function_test", columnDefinition = "TEXT")
    private String pulmonaryFunctionTest;

    // ── 8. Hospital course ────────────────────────────────────────────────────

    @Column(name = "hospital_course", columnDefinition = "TEXT")
    private String hospitalCourse;

    // ── 9. Medications / treatment given in hospital ──────────────────────────

    @Column(name = "treatment_in_hospital", columnDefinition = "TEXT")
    private String treatmentInHospital;   // Free-text list: drug name, route, dose × days

    // ── 10. Condition at discharge ────────────────────────────────────────────

    @Column(name = "condition_at_discharge", columnDefinition = "TEXT")
    private String conditionAtDischarge;

    // ── 11. Discharge medication ──────────────────────────────────────────────

    @Column(name = "discharge_medication", columnDefinition = "TEXT")
    private String dischargeMedication;   // Free-text: drug name, dosage schedule × days

    // ── 12. Discharge advice ──────────────────────────────────────────────────

    @Column(name = "discharge_advice", columnDefinition = "TEXT")
    private String dischargeAdvice;

    // ── 13. Follow-up ─────────────────────────────────────────────────────────

    @Column(name = "follow_up", columnDefinition = "TEXT")
    private String followUp;

    // ── Consultant signature / designation ────────────────────────────────────

    @Column(name = "consultant_designation", length = 200)
    private String consultantDesignation; // e.g. "MBBS, MS, MCh"

    // ── Structured summary (AI upload) ────────────────────────────────────────

    @Column(name = "icu_consultant", length = 150)
    private String icuConsultant;

    @Column(name = "drug_allergy", length = 255)
    private String drugAllergy;

    /** Full nested discharge-summary JSON (hospital template) — source of truth when present */
    @Column(name = "structured_json", columnDefinition = "LONGTEXT")
    private String structuredJson;
}
