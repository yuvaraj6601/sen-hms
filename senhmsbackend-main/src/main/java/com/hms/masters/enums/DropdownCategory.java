package com.hms.masters.enums;

/**
 * Category of a managed dropdown option stored in the single
 * {@code dropdown_options} table.
 *
 * <ul>
 *   <li>{@link #AREA}     — patient / OP-visit area (locality) list</li>
 *   <li>{@link #DISTRICT} — district list (OP visit + patient registration)</li>
 *   <li>{@link #UNIT}     — measurement unit list used by Lab Masters (mg/dL, g/dL, %…)</li>
 *   <li>{@link #TPA}      — Third Party Administrator names (standalone list, selectable
 *                           across billing and insurance-claim screens)</li>
 * </ul>
 *
 * New categories can be added here without any schema change — they all share
 * the same table, keyed by this enum.
 */
public enum DropdownCategory {
    AREA,
    DISTRICT,
    UNIT,
    TPA
}
