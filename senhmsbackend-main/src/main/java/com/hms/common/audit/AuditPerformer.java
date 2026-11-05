package com.hms.common.audit;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * A user who appears in the audit log, used to populate the User filter.
 * {@code email} is the value used for filtering; {@code name} is the username
 * shown in the dropdown.
 */
@Getter
@AllArgsConstructor
public class AuditPerformer {
    private final String email;
    private final String name;
}
