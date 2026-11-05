package com.hms.modules.opvisit.enums;

/**
 * How the OP visit was created.
 *
 * ML  — Manual / counter-level registration (receptionist adds the patient)
 * VS  — Visitor Self-registration via QR code form
 */
public enum RegistrationSource {
    ML,   // Manual (receptionist / staff)
    VS    // Visitor Self-registration (QR form)
}
