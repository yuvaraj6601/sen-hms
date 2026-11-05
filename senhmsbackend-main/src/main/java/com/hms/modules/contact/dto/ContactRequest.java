package com.hms.modules.contact.dto;

import com.hms.modules.contact.enums.ContactType;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class ContactRequest {

    @NotBlank(message = "Name is required")
    @Size(max = 150)
    private String name;

    @NotNull(message = "Type is required")
    private ContactType type;

    @NotBlank(message = "Phone is required")
    @Size(max = 20)
    private String phone;

    @Email
    @Size(max = 100)
    private String email;

    @Size(max = 200)
    private String organization;

    private String address;

    @Size(max = 100)
    private String area;

    @Size(max = 100)
    private String district;

    private String notes;
}
