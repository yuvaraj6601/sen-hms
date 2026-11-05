package com.hms.masters.dto;

import com.hms.masters.enums.Status;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class InsuranceCompanyRequest {

    @NotBlank(message = "Company name is required")
    @Size(max = 150)
    private String name;

    @Size(max = 150)
    private String tpaName;

    /** Multiple TPA names empanelled for this insurer. */
    private java.util.List<String> tpaNames;

    @Size(max = 100)
    private String contactPerson;

    @Size(max = 20)
    private String phone;

    @Email
    @Size(max = 100)
    private String email;

    private String address;

    /** Tariff contract validity period (Option A: one range per insurer) */
    private java.time.LocalDate tariffEffectiveFrom;
    private java.time.LocalDate tariffEffectiveTo;

    private Status status = Status.ACTIVE;
}
