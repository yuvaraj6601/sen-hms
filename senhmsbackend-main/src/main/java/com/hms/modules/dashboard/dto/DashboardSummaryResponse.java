package com.hms.modules.dashboard.dto;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
public class DashboardSummaryResponse {

    private LocalDate date;

    // ── Patient counts ────────────────────────────────────────────────────────
    private long todayOpVisits;
    private long todayAdmissions;
    private long currentInpatients;     // currently admitted (not discharged)
    private long todayDischarges;
    private long todayAppointments;

    // ── Bed occupancy ─────────────────────────────────────────────────────────
    private int totalBeds;
    private int occupiedBeds;
    private int availableBeds;
    private double occupancyPercent;

    // ── Revenue (today) ───────────────────────────────────────────────────────
    private BigDecimal todayRevenue;      // bills paid today
    private BigDecimal pendingBillsTotal; // total outstanding across all bills

    // ── Insurance ─────────────────────────────────────────────────────────────
    private long pendingClaimsCount;
    private BigDecimal pendingClaimsAmount;

    // ── Lab ───────────────────────────────────────────────────────────────────
    private long labPendingCount;
    private long labInProgressCount;
    private long labStatCount;           // STAT priority pending

    // ── Expenses (this month) ─────────────────────────────────────────────────
    private BigDecimal monthlyExpenses;

    // ── Free / Charity patients ───────────────────────────────────────────────
    private long freePatientCount;
}
