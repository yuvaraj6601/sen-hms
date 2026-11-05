package com.hms.masters.dto;

import com.hms.masters.enums.IcdCodeType;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class IcdCodeResponse {

    private Long        id;
    private String      complaint;
    private String      icdCode;
    private String      description;
    private IcdCodeType codeType;
    private String      status;
    private String      createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
