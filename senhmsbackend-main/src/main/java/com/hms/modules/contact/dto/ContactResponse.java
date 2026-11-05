package com.hms.modules.contact.dto;

import com.hms.modules.contact.enums.ContactType;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ContactResponse {
    private Long id;
    private String name;
    private ContactType type;
    private String phone;
    private String email;
    private String organization;
    private String address;
    private String area;
    private String district;
    private String notes;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
