package com.hms.modules.billing.dto;

import com.hms.modules.billing.enums.BillStatus;
import com.hms.modules.billing.enums.InsuranceStatus;
import com.hms.modules.billing.enums.PaymentMode;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class BillResponse {

    private Long id;
    private String billNo;
    private LocalDate date;

    // Patient
    private Long patientId;
    private String patientName;
    private String uhid;
    private String patientType;
    private Integer age;
    private String gender;
    private String phone;
    private String address;
    private String doctorName;
    private String department;
    private String ward;
    private String bedNumber;
    private LocalDate admittedDate;
    private String admittedTime;
    private String towards;

    // Links
    private Long admissionId;
    private Long visitId;

    // Line items
    private List<BillItemResponse> items;

    // Financials
    private BigDecimal subtotal;
    private BigDecimal totalDiscount;
    private BigDecimal totalAmount;
    private BigDecimal paidAmount;
    private BigDecimal dueAmount;
    private PaymentMode paymentMode;
    private String referenceNo;

    // OP token advance + free-consultation refund
    private BigDecimal initialCollected;
    private BigDecimal refundAmount;
    private boolean free;

    // Payment history
    private List<PaymentRecordResponse> payments;

    // Status
    private BillStatus status;
    private String cancellationReason;

    // Consolidated / Summary IP bill
    private boolean consolidated;
    private String billFormat;
    private String consolidatesBillIds;
    private Long supersededByBillId;
    private LocalDate dischargeDate;

    // Insurance
    private boolean insurance;
    private String insuranceCompany;
    private Long insuranceCompanyId;
    private String policyNo;
    private String insuredPersonName;
    private String cardNumber;
    private BigDecimal claimedAmount;
    private BigDecimal insurancePaidAmount;
    private InsuranceStatus insuranceStatus;
    private String insuranceRemarks;
    private boolean insuranceTariffApplied;
    private BigDecimal insuranceWriteOff;
    private boolean insuranceLocked;
    private boolean patientShareClosed;

    // Audit
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
