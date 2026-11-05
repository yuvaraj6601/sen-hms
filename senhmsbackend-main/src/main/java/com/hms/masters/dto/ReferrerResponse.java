package com.hms.masters.dto;

import com.hms.masters.enums.ReferrerType;
import com.hms.masters.enums.Status;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ReferrerResponse {
    private Long id;
    private String name;
    private ReferrerType type;
    private String specialization;
    private String organization;
    private String phone;
    private String alternatePhone;
    private String address;
    private String notes;
    private Integer totalReferrals;
    private Status status;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
