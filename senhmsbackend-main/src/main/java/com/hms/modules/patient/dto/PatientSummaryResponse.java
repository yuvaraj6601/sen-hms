package com.hms.modules.patient.dto;

import com.hms.masters.enums.Gender;
import com.hms.modules.patient.enums.PatientType;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Lightweight projection used in search / dropdown lists.
 * Avoids returning the full entity when only basic info is needed.
 */
@Data
public class PatientSummaryResponse {

    private Long id;
    private String uhid;
    private String name;
    private LocalDate dateOfBirth;
    private Integer age;
    private Gender gender;
    private String phone;
    private String doctorName;
    private String department;
    private PatientType patientType;
    private boolean active;
    /**
     * Registration timestamp (audited createdAt). Exposed so the patient list can
     * show the registration date and so the From/To date filter can run server-side
     * alongside paging instead of client-side on the current page only.
     */
    private LocalDateTime createdAt;

    /**
     * Current episode summary used by the patient list to show where the patient
     * is / their latest activity. For an active IP it reflects the active
     * admission (ward / bed / admission no); otherwise it reflects the latest OP
     * visit (visit no / token). Null when the patient has neither.
     */
    private CurrentEpisode currentEpisode;

    @Data
    public static class CurrentEpisode {
        /** "IP" when backed by an active admission, "OP" when backed by an OP visit. */
        private String kind;
        /** Active admission id — IP only. Lets the client scope receipts/billing to the current admission. */
        private Long admissionId;
        /** Admission no (IP) or visit no (OP). */
        private String episodeNo;
        /** Token no — OP only. */
        private String tokenNo;
        /** Admission date (IP) or visit date (OP). */
        private LocalDate episodeDate;
        /** Ward name — IP only. */
        private String wardName;
        /** Bed number — IP only. */
        private String bedNumber;
        /** Admission status (IP) or visit status (OP), as the raw enum name. */
        private String status;
        /** Whether the active admission is an insurance case — IP only. */
        @com.fasterxml.jackson.annotation.JsonProperty("isInsurance")
        private boolean isInsurance;
        /** Insurance workflow status enum name — IP insurance cases only. */
        private String insuranceStatus;
    }
}
