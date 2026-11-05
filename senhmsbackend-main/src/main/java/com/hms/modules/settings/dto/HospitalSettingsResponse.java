package com.hms.modules.settings.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class HospitalSettingsResponse {
    private Long id;
    private String hospitalName;
    private String hospitalNameSecondary;
    private String address;
    private String city;
    private String state;
    private String pinCode;
    private String phone;
    private String alternatePhone;
    private String email;
    private String website;
    private String gstNo;
    private String regNo;
    private String dlNo;
    private String billSettingsJson;
    private String documentSettingsJson;
    private String watermarkSettingsJson;
    private String updatedBy;
    private LocalDateTime updatedAt;
}
