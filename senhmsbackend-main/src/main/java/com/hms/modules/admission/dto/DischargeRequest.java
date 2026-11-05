package com.hms.modules.admission.dto;

import com.hms.modules.admission.enums.ConditionOnDischarge;
import com.hms.modules.admission.enums.DischargeType;
import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDate;

@Data
public class DischargeRequest {

    @NotNull(message = "Discharge type is required")
    private DischargeType dischargeType;

    @NotNull(message = "Discharge date is required")
    private LocalDate dischargeDate;

    @Size(max = 10)
    private String dischargeTime;

    @Size(max = 150)
    private String dischargingDoctorName;

    private String finalDiagnosis;

    private String proceduresPerformed;

    private ConditionOnDischarge conditionOnDischarge;

    private LocalDate followUpDate;

    /** Filled when dischargeType = REFERRED */
    @Size(max = 200)
    private String referredTo;

    private String dischargeNotes;
}
