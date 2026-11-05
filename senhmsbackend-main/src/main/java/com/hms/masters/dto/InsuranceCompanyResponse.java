package com.hms.masters.dto;

import com.hms.masters.enums.Status;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class InsuranceCompanyResponse {
    private Long id;
    private String companyCode;
    private String name;
    private String tpaName;
    private java.util.List<String> tpaNames;
    private String contactPerson;
    private String phone;
    private String email;
    private String address;
    private java.time.LocalDate tariffEffectiveFrom;
    private java.time.LocalDate tariffEffectiveTo;
    private Status status;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
