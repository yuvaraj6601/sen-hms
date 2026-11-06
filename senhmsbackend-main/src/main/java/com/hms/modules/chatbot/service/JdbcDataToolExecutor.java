package com.hms.modules.chatbot.service;

import com.hms.modules.chatbot.dto.DataAnswer;
import com.hms.modules.chatbot.enums.DataTool;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.ZoneId;

/** Dispatches a catalogue tool to its fixed, parameterised query. No SQL ever comes from the model or the user. */
@Service
@RequiredArgsConstructor
public class JdbcDataToolExecutor implements DataToolExecutor {

    private static final ZoneId HOSPITAL_ZONE = ZoneId.of("Asia/Kolkata");

    private final PatientDataQueries patients;
    private final FinanceDataQueries finance;

    @Override
    public DataAnswer execute(DataTool tool) {
        LocalDate today = LocalDate.now(HOSPITAL_ZONE);
        return switch (tool) {
            case OP_TODAY -> patients.opToday(today);
            case OP_VS_IP_7D -> patients.opVsIp7d(today);
            case CURRENT_INPATIENTS -> patients.currentInpatients();
            case ADMISSIONS_DISCHARGES_TODAY -> patients.admissionsDischargesToday(today);
            case AVG_LENGTH_OF_STAY -> patients.avgLengthOfStay(today);
            case TOP_DOCTORS_VISITS -> patients.topDoctors(today);
            case DEPARTMENT_VISITS -> patients.departmentVisits(today);
            case REVENUE_TODAY -> finance.revenueToday(today);
            case REVENUE_MONTH -> finance.revenueMonth(today);
            case MONTHLY_REVENUE_YEAR -> finance.monthlyRevenueYear(today);
            case PAYMENT_MODE_SPLIT -> finance.paymentModeSplit(today);
            case PENDING_DUES -> finance.pendingDues();
            case EXPENSES_MONTH -> finance.expensesMonth(today);
            case EXPENSES_BY_CATEGORY -> finance.expensesByCategory(today);
            case NET_CASH_MONTH -> finance.netCashMonth(today);
            case PENDING_CLAIMS -> finance.pendingClaims();
            case CLAIMS_BY_STATUS -> finance.claimsByStatus();
            case LAB_PENDING -> patients.labPending();
            case TOP_LAB_TESTS -> patients.topLabTests(today);
            case BED_OCCUPANCY -> patients.bedOccupancy();
        };
    }
}
