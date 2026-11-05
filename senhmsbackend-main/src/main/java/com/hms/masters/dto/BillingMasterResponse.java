package com.hms.masters.dto;

import com.hms.masters.enums.Status;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class BillingMasterResponse {
    private Long id;
    private String serviceCode;
    private String serviceName;
    private Long modalityId;
    private String modalityName;
    private String modalityCode;
    private BigDecimal price;
    private boolean discountAllowed;
    private boolean showInOp;
    private Status status;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
