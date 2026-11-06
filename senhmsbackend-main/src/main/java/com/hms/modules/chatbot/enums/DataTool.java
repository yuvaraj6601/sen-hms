package com.hms.modules.chatbot.enums;

import lombok.Getter;

import java.util.Set;

/**
 * The fixed catalogue of read-only hospital-data questions the chatbot can answer.
 * Each entry maps to one aggregate database query (see the *DataQueries classes) —
 * the AI never writes SQL, it can only pick one of these.
 * Role names are {@code UserRole} enum names (no ROLE_ prefix).
 */
@Getter
public enum DataTool {

    // ── Patients ──
    OP_TODAY("How many OP patients today?", ToolCategory.PATIENTS, Roles.OPS),
    OP_VS_IP_7D("Show OP vs IP for the last 7 days", ToolCategory.PATIENTS, Roles.OPS),
    CURRENT_INPATIENTS("How many patients are currently admitted?", ToolCategory.PATIENTS, Roles.OPS),
    ADMISSIONS_DISCHARGES_TODAY("How many admissions and discharges today?", ToolCategory.PATIENTS, Roles.OPS),
    AVG_LENGTH_OF_STAY("What is the average length of stay (last 30 days)?", ToolCategory.PATIENTS, Roles.OPS),
    TOP_DOCTORS_VISITS("Doctor-wise OP visits this month", ToolCategory.PATIENTS, Roles.OPS),
    DEPARTMENT_VISITS("Department-wise OP visits this month", ToolCategory.PATIENTS, Roles.OPS),

    // ── Revenue ──
    REVENUE_TODAY("How much was collected today?", ToolCategory.REVENUE, Roles.FINANCE),
    REVENUE_MONTH("Total revenue this month?", ToolCategory.REVENUE, Roles.FINANCE),
    MONTHLY_REVENUE_YEAR("Show monthly revenue chart for this year", ToolCategory.REVENUE, Roles.FINANCE),
    PAYMENT_MODE_SPLIT("Collection by payment mode this month", ToolCategory.REVENUE, Roles.FINANCE),
    PENDING_DUES("What are the pending dues?", ToolCategory.REVENUE, Roles.FINANCE),

    // ── Expenses ──
    EXPENSES_MONTH("Total expenses this month?", ToolCategory.EXPENSES, Roles.FINANCE),
    EXPENSES_BY_CATEGORY("Expenses by category this month", ToolCategory.EXPENSES, Roles.FINANCE),
    NET_CASH_MONTH("Net cash (revenue minus expenses) this month?", ToolCategory.EXPENSES, Roles.FINANCE),

    // ── Insurance ──
    PENDING_CLAIMS("How many insurance claims are pending?", ToolCategory.INSURANCE, Roles.INSURANCE),
    CLAIMS_BY_STATUS("Insurance claims by status", ToolCategory.INSURANCE, Roles.INSURANCE),

    // ── Lab ──
    LAB_PENDING("How many lab orders are pending?", ToolCategory.LAB, Roles.LAB),
    TOP_LAB_TESTS("Most ordered lab tests this month", ToolCategory.LAB, Roles.LAB),

    // ── Beds ──
    BED_OCCUPANCY("Bed occupancy by ward", ToolCategory.BEDS, Roles.OPS);

    private final String question;
    private final ToolCategory category;
    private final Set<String> roles;

    DataTool(String question, ToolCategory category, Set<String> roles) {
        this.question = question;
        this.category = category;
        this.roles = roles;
    }

    /** Role sets kept in a holder so enum constants can reference them. */
    private static final class Roles {
        static final Set<String> OPS = Set.of("MANAGING_DIRECTOR", "ADMIN", "DOCTOR", "RECEPTIONIST", "NURSE", "LAB_INS_REC");
        static final Set<String> FINANCE = Set.of("MANAGING_DIRECTOR", "ADMIN");
        static final Set<String> INSURANCE = Set.of("MANAGING_DIRECTOR", "ADMIN", "INSURANCE_COORDINATOR");
        static final Set<String> LAB = Set.of("MANAGING_DIRECTOR", "ADMIN", "DOCTOR", "LAB_TECH", "RECEPTIONIST", "NURSE", "LAB_INS_REC");
    }
}
