package com.hms.modules.expense.entity;

import com.hms.common.BaseEntity;
import com.hms.modules.expense.enums.ExpensePaymentMode;
import com.hms.modules.expense.enums.ExpenseStatus;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "expenses")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Expense extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "expense_no", unique = true, nullable = false, length = 20)
    private String expenseNo;

    @Column(nullable = false)
    private LocalDate date;

    /** Category name — references expense_categories master by name for denormalization */
    @Column(nullable = false, length = 100)
    private String category;

    /** Towards: Staff / Department / Vendor — free text */
    @Column(nullable = false, length = 200)
    private String towards;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_mode", nullable = false, length = 20)
    private ExpensePaymentMode paymentMode;

    @Column(name = "reference_no", length = 50)
    private String referenceNo;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(name = "prepared_by", nullable = false, length = 100)
    private String preparedBy;

    @Column(name = "approved_by", length = 100)
    private String approvedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 15)
    private ExpenseStatus status = ExpenseStatus.PENDING;

    @Column(name = "rejection_reason", columnDefinition = "TEXT")
    private String rejectionReason;
}
