package com.hms.modules.settings.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class HospitalSettingsRequest {

    @NotBlank(message = "Hospital name is required")
    @Size(max = 200)
    private String hospitalName;

    @Size(max = 200)
    private String hospitalNameSecondary;

    private String address;

    @Size(max = 100)
    private String city;

    @Size(max = 100)
    private String state;

    @Size(max = 10)
    private String pinCode;

    @Size(max = 20)
    private String phone;

    @Size(max = 20)
    private String alternatePhone;

    @Email @Size(max = 100)
    private String email;

    @Size(max = 100)
    private String website;

    @Size(max = 50)
    private String gstNo;

    @Size(max = 100)
    private String regNo;

    @Size(max = 100)
    private String dlNo;

    /** Raw JSON string for bill layout/color/section configuration */
    private String billSettingsJson;

    /** Raw JSON for document print settings */
    private String documentSettingsJson;

    /** Raw JSON for watermark settings */
    private String watermarkSettingsJson;
}
