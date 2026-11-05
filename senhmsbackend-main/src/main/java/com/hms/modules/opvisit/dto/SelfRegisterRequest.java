package com.hms.modules.opvisit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * Payload from the patient-facing QR self-registration form.
 * No JWT needed — this is a public endpoint.
 */
@Data
public class SelfRegisterRequest {

    @NotBlank(message = "Name is required")
    @Size(max = 150)
    private String name;

    @NotBlank(message = "Mobile is required")
    @Size(max = 20)
    private String mobile;

    /** ISO date string YYYY-MM-DD — optional */
    private String dob;

    /** Pre-calculated age — fallback when DOB not provided */
    private Integer age;

    /** Male / Female / Other */
    private String gender;

    /** Patient address — optional, shown on the OP registration slip */
    private String address;

    /** New / Review / Follow-up */
    private String visitType;

    /** Registration type — CONSULTATION / XRAY / REVIEW / PHYSIOTHERAPY / OTHERS */
    private String regType;

    @NotBlank(message = "Illness / reason for visit is required")
    private String illness;

    // Optional doctor selection (if the QR form ever adds a doctor picker)
    private String doctorId;
    private String doctorName;
}
