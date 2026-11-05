package com.hms.modules.opvisit.dto;

import com.hms.modules.opvisit.enums.OPVisitType;
import com.hms.modules.opvisit.enums.RegType;
import com.hms.modules.opvisit.enums.RegistrationSource;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDate;

@Data
public class OPVisitRequest {

    // ── Patient ───────────────────────────────────────────────────────────────
    private String patientId;

    @NotBlank(message = "UHID is required")
    @Size(max = 20)
    private String uhid;

    @NotBlank(message = "Patient name is required")
    @Size(max = 150)
    private String patientName;

    /** Date of birth — used to auto-register walk-ins with accurate DOB. */
    private LocalDate dob;

    private Integer age;

    @Size(max = 10)
    private String gender;

    @NotBlank(message = "Mobile number is required")
    @Pattern(regexp = "\\d{10}", message = "Mobile number must be 10 digits")
    @Size(max = 20)
    private String phone;

    /** Patient address — shown on the OP registration slip. */
    private String address;

    @Size(max = 255)
    private String address1;

    @Size(max = 255)
    private String address2;

    @Size(max = 100)
    private String area;

    @Size(max = 100)
    private String district;

    @Size(max = 10)
    private String pincode;

    @Size(max = 100)
    private String state;

    @Size(max = 20)
    private String maritalStatus;

    @Size(max = 50)
    private String religion;

    @Size(max = 5)
    private String bloodGroup;

    @Email(message = "Invalid email")
    @Size(max = 150)
    private String email;

    @Size(max = 20)
    private String aadhaarNo;

    /** Payment type: CASH / CREDIT / INSURANCE etc. */
    @Size(max = 30)
    private String paymentType;

    @Size(max = 150)
    private String companyTpa;

    // ── Doctor ────────────────────────────────────────────────────────────────
    @NotBlank(message = "Doctor ID is required")
    private String doctorId;

    @NotBlank(message = "Doctor name is required")
    @Size(max = 150)
    private String doctorName;

    @Size(max = 100)
    private String department;

    // ── Visit ─────────────────────────────────────────────────────────────────
    @NotNull(message = "Visit date is required")
    private LocalDate visitDate;

    @Size(max = 10)
    private String visitTime;

    private OPVisitType type = OPVisitType.NEW;

    /** Registration type — Consultation / X-ray / Scan / Review / Physiotherapy / Others. */
    private RegType regType = RegType.CONSULTATION;

    private String chiefComplaint;

    /** ML = Manual (staff), VS = Visitor Self-registration. Defaults to ML. */
    private RegistrationSource registrationSource = RegistrationSource.ML;

    /** Referred by (name of referrer — optional). */
    @Size(max = 150)
    private String referredBy;

    /** Whether this visit is free of charge (charity / waived). */
    private boolean free = false;

    // ── Token-time payment (collected when the OP slip is generated) ──────────
    /** Consultation charge (auto-filled from the doctor's OPD fee; receptionist may edit). */
    private java.math.BigDecimal consultationAmount;

    /** Discount applied. When equal to consultationAmount the visit is free. */
    private java.math.BigDecimal discountAmount;

    /** Amount actually collected = consultationAmount − discountAmount. */
    private java.math.BigDecimal paidAmount;

    /** JSON array of split payments, e.g. [{"mode":"CASH","amount":500},{"mode":"CARD","amount":500}]. */
    private String paymentSplitsJson;
}
