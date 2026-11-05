package com.hms.common;


import com.hms.masters.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "audit_log",
        indexes = {
                @Index(name = "idx_audit_entity", columnList = "entity_type, entity_id"),
                @Index(name = "idx_audit_user", columnList = "user_id"),
                @Index(name = "idx_audit_created_at", columnList = "created_at")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * Entity that was changed.
     * Example: Bill, Payment, Patient, Prescription
     */
    @Column(name = "entity_type", nullable = false, length = 100)
    private String entityType;

    /**
     * ID of the entity that was changed.
     * Example: Bill ID = 10025
     */
    @Column(name = "entity_id")
    private Long entityId;

    /**
     * CREATE, UPDATE, DELETE, APPROVE, CANCEL, etc.
     */
    @Column(name = "action", nullable = false, length = 50)
    private String action;

    /**
     * User who performed the action.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    /**
     * Data before the change.
     */

    @Column(name = "old_data", columnDefinition = "JSON")
    private String oldData;

    /**
     * Data after the change.
     */
    @Column(name = "new_data", columnDefinition = "JSON")
    private String newData;

    /**
     * IP address of the user.
     */
    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    /**
     * Browser / client information.
     */
    @Column(name = "user_agent", columnDefinition = "TEXT")
    private String userAgent;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
