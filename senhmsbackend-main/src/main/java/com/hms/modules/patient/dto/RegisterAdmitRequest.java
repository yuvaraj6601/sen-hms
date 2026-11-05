package com.hms.modules.patient.dto;

import com.hms.modules.admission.dto.AdmissionRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Combined payload to register a brand-new IN-patient and admit them in a
 * single atomic operation.
 *
 * The patient does not exist yet, so {@link AdmissionRequest#getPatientId()} is
 * populated server-side after the patient is created — it is intentionally NOT
 * bean-validated here (it would be null at request time).
 */
@Data
public class RegisterAdmitRequest {

    @Valid
    @NotNull(message = "Patient details are required")
    private PatientRequest patient;

    @NotNull(message = "Admission details are required")
    private AdmissionRequest admission;
}
