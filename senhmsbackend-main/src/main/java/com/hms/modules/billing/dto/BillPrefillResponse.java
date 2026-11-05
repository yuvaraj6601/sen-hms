package com.hms.modules.billing.dto;

import lombok.Data;
import java.util.List;

/**
 * Returned by GET /api/bills/prefill?admissionId=X
 * Contains auto-calculated line items that staff can edit before saving.
 */
@Data
public class BillPrefillResponse {

    // Patient / admission context (pre-fills the bill header)
    private Long   admissionId;
    private String admissionNo;
    private Long   patientId;
    private String patientName;
    private String uhid;
    private String patientType;
    private Integer age;
    private String gender;
    private String phone;
    private String doctorName;
    private String department;
    private String ward;
    private String bedNumber;
    private String admittedDate;  // ISO date string "YYYY-MM-DD"
    private String admittedTime;  // free-form time string from the admission, e.g. "14:30"

    // Insurance context (pre-fills the bill's insurance block for cashless patients)
    private String  insuranceCompany;
    private Long    insuranceCompanyId;
    private String  policyNo;
    private String  tpaName;
    private String  preAuthNumber;
    private String  insuredPersonName;
    private String  cardNumber;
    private String  insuranceClaimType;  // "REIMBURSEMENT" | "CASHLESS" | null

    /** Pre-calculated, editable line items */
    private List<PrefillItem> items;

    /** Lab tests already included in a previous bill (shown read-only as reference) */
    private List<PreviouslyBilledLab> previouslyBilledLabs;

    @Data
    public static class PrefillItem {
        private String  serviceCode;    // null for ad-hoc items (e.g. ward charges)
        private String  modalityName;
        private String  description;    // e.g. "General Ward (B-03) — 2 days"
        private String  serviceDate;    // ISO date "YYYY-MM-DD" the service was rendered (ward segment start / lab ordered date)
        private int     quantity;
        private double  unitPrice;
        private double  discount;
        private double  total;
        private String  sourceType;     // "WARD_CHARGE", "LAB_TEST", or "MANUAL"
        private Long    labId;          // set when sourceType = LAB_TEST
    }

    @Data
    public static class PreviouslyBilledLab {
        private Long   labId;
        private String labIdCode;
        private String investigationName;
        private double price;
        private String billedInBillNo;
    }
}