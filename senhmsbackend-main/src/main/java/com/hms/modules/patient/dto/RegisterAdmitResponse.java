package com.hms.modules.patient.dto;

import com.hms.modules.admission.dto.AdmissionResponse;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Result of an atomic register-and-admit operation: the newly created patient
 * and the admission raised for them.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegisterAdmitResponse {
    private PatientResponse patient;
    private AdmissionResponse admission;
}
