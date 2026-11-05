package com.hms.modules.opvisit.entity;

import com.hms.common.BaseEntity;
import com.hms.modules.opvisit.enums.OPVisitStatus;
import com.hms.modules.opvisit.enums.OPVisitType;
import com.hms.modules.opvisit.enums.RegType;
import com.hms.modules.opvisit.enums.RegistrationSource;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;

@Entity
@Table(name = "op_visits")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class OPVisit extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Unique visit number: OPV-2026-00001 */
    @Column(name = "visit_no", unique = true, nullable = false, length = 25)
    private String visitNo;

    /** Token number per doctor per day: T001, T002 … */
    @Column(name = "token_no", nullable = false, length = 25)
    private String tokenNo;

    // ── Patient info (denormalised for speed) ─────────────────────────────────
    @Column(name = "patient_id", length = 50)
    private String patientId;         // internal patient pk (string from frontend)

    @Column(nullable = false, length = 20)
    private String uhid;

    @Column(name = "patient_name", nullable = false, length = 150)
    private String patientName;

    private Integer age;

    @Column(length = 10)
    private String gender;

    @Column(length = 20)
    private String phone;

    @Column(name = "address", columnDefinition = "TEXT")
    private String address;

    /** Address line 1 (door no / street). */
    @Column(name = "address1", length = 255)
    private String address1;

    /** Address line 2 (locality). */
    @Column(name = "address2", length = 255)
    private String address2;

    @Column(name = "area", length = 100)
    private String area;

    @Column(name = "district", length = 100)
    private String district;

    @Column(name = "pincode", length = 10)
    private String pincode;

    @Column(name = "state", length = 100)
    private String state;

    @Column(name = "marital_status", length = 20)
    private String maritalStatus;

    @Column(name = "religion", length = 50)
    private String religion;

    @Column(name = "blood_group", length = 5)
    private String bloodGroup;

    @Column(name = "email", length = 150)
    private String email;

    @Column(name = "aadhaar_no", length = 20)
    private String aadhaarNo;

    /** Payment type shown on the registration screen: CASH / CREDIT / INSURANCE etc. */
    @Column(name = "payment_type", length = 30)
    private String paymentType;

    /** Company / TPA (for insurance / credit patients). */
    @Column(name = "company_tpa", length = 150)
    private String companyTpa;

    // ── Doctor ────────────────────────────────────────────────────────────────
    @Column(name = "doctor_id", nullable = false, length = 50)
    private String doctorId;

    @Column(name = "doctor_name", nullable = false, length = 150)
    private String doctorName;

    @Column(length = 100)
    private String department;

    // ── Visit details ─────────────────────────────────────────────────────────
    @Column(name = "visit_date", nullable = false)
    private LocalDate visitDate;

    @Column(name = "visit_time", length = 10)
    private String visitTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OPVisitType type = OPVisitType.NEW;

    /** Registration type — drives the token prefix (CONSULTATION → CON…). */
    @Enumerated(EnumType.STRING)
    @Column(name = "reg_type", nullable = false, length = 20)
    private RegType regType = RegType.CONSULTATION;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 25)
    private OPVisitStatus status = OPVisitStatus.WAITING;

    @Column(name = "chief_complaint", columnDefinition = "TEXT")
    private String chiefComplaint;

    @Column(name = "bill_id", length = 50)
    private String billId;

    /** Whether this OP visit was provided free of charge (charity / waived). Per-visit fact. */
    @Column(name = "free", nullable = false)
    private boolean free = false;

    // ── Token-time payment (collected when the OP slip is generated) ──────────
    /** Consultation charge for this visit (auto-filled from the doctor's OPD fee). */
    @Column(name = "consultation_amount", precision = 12, scale = 2)
    private java.math.BigDecimal consultationAmount;

    /** Discount applied by the receptionist. When it equals consultationAmount the visit is free. */
    @Column(name = "discount_amount", precision = 12, scale = 2)
    private java.math.BigDecimal discountAmount;

    /** Amount actually collected = consultationAmount − discountAmount. Printed on the slip as "Paid". */
    @Column(name = "paid_amount", precision = 12, scale = 2)
    private java.math.BigDecimal paidAmount;

    /**
     * JSON array of split payments collected at token time, e.g.
     * [{"mode":"CASH","amount":500},{"mode":"CREDIT_CARD","amount":500}].
     * Null / empty for a single-mode payment (paymentType holds the mode then).
     */
    @Column(name = "payment_splits_json", columnDefinition = "TEXT")
    private String paymentSplitsJson;

    /** Referred by (name of referrer). */
    @Column(name = "referred_by", length = 150)
    private String referredBy;

    /** How this visit was registered: ML = Manual (staff), VS = Visitor Self-registration (QR). */
    @Enumerated(EnumType.STRING)
    @Column(name = "registration_source", nullable = false, length = 5)
    private RegistrationSource registrationSource = RegistrationSource.ML;
}
