package com.hms.masters.dto;

import com.hms.masters.enums.Status;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class WardResponse {
    private Long id;
    private String wardCode;
    private String name;
    private String wardType;
    private Long departmentId;
    private String departmentName;
    private int totalBeds;
    private int occupiedBeds;
    private int availableBeds;
    private Double chargePerDay;
    private Status status;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<BedResponse> beds;
}
