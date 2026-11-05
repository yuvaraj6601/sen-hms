package com.hms.modules.dailysummary.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class DailySummaryResponse {

    private LocalDate date;
    private String status;           // DRAFT / SUBMITTED
    private String submittedBy;
    private LocalDateTime submittedAt;

    // ── Billing section ───────────────────────────────────────────────────────
    private List<BillSummaryItem> bills;
    private BigDecimal totalBillAmount;
    private BigDecimal totalBillPaid;
    private BigDecimal billCash;
    private BigDecimal billCard;
    private BigDecimal billUpi;
    private BigDecimal billCheque;
    private BigDecimal billInsurance;

    // ── Insurance claims section ──────────────────────────────────────────────
    private List<ClaimSummaryItem> claims;
    private BigDecimal totalClaimsSubmitted;
    private BigDecimal totalClaimsSettled;

    // ── Expenses section ──────────────────────────────────────────────────────
    private List<ExpenseSummaryItem> expenses;
    private BigDecimal totalExpenses;
    private BigDecimal expenseCash;
    private BigDecimal expenseUpi;
    private BigDecimal expenseCheque;
    private BigDecimal expenseBankTransfer;

    // ── Manual entries ────────────────────────────────────────────────────────
    private List<ManualEntryResponse> manualEntries;
    private BigDecimal manualTotal;
    private BigDecimal manualCash;
    private BigDecimal manualUpi;
    private BigDecimal manualCard;
    private BigDecimal manualCheque;

    // ── Net totals ────────────────────────────────────────────────────────────
    private BigDecimal totalIncome;      // bills paid + manual entries
    private BigDecimal totalExpense;     // expenses
    private BigDecimal netCollection;    // income - expense

    // ── OP / IP counts ────────────────────────────────────────────────────────
    private long opVisitCount;
    private long admittedCount;
    private long dischargedCount;
    private long appointmentCount;

    // ─── Inner DTOs ───────────────────────────────────────────────────────────

    @Data
    public static class BillSummaryItem {
        private String billNo;
        private String patientName;
        private String uhid;
        private String patientType;
        private String doctorName;
        private BigDecimal totalAmount;
        private BigDecimal paidAmount;
        private String paymentMode;
        private String status;
    }

    @Data
    public static class ClaimSummaryItem {
        private String claimNo;
        private String billNo;
        private String patientName;
        private String insuranceCompany;
        private BigDecimal claimedAmount;
        private BigDecimal settledAmount;
        private String status;
    }

    @Data
    public static class ExpenseSummaryItem {
        private String expenseNo;
        private String category;
        private String towards;
        private BigDecimal amount;
        private String paymentMode;
        private String status;
    }

    @Data
    public static class ManualEntryResponse {
        private Long id;
        private Integer sno;
        private String patientName;
        private Integer age;
        private String sex;
        private String visitType;
        private String consultantName;
        private String diagnosis;
        private String paymentMode;
        private BigDecimal amount;
        private String paymentSplitsJson;
        private String notes;
        private LocalDateTime createdAt;
    }
}
