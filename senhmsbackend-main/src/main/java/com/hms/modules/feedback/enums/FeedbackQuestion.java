package com.hms.modules.feedback.enums;

/**
 * The 18 fixed NABH patient-satisfaction statements, in the exact order and
 * wording of the hospital's printed feedback form (used for NABH submission).
 *
 * The stable enum {@code name()} is persisted against each answer row so the
 * report stays correct even if the display text is later reworded. The English
 * and Tamil display strings are carried for the on-screen form and the printable
 * NABH report.
 */
public enum FeedbackQuestion {

    RECEPTION_SERVICE(1, "The Reception / Enquiry Service is", "வரவேற்பு / விசாரணை சேவை"),
    HOSPITAL_ENVIRONMENT(2, "The Hospital Environment is", "மருத்துவமனையின் சூழ்நிலை"),
    WARD_FACILITIES(3, "The Ward Facilities are", "வார்டு வசதிகள்"),
    ADMISSION_PROCESS(4, "Admission Process", "சேர்க்கை முறை"),
    LABORATORY_SERVICE(5, "Laboratory Service", "ஆய்வக சேவை"),
    AMBULANCE_SERVICE(6, "Ambulance Service", "அவசர ஊர்தி சேவை"),
    NURSING_CARE(7, "Nursing Care", "மருத்துவ பராமரிப்பு"),
    INTENSIVE_CARE(8, "Intensive care", "தீவிர சிகிச்சை"),
    SURGICAL_SERVICE(9, "Surgical Service", "அறுவை சிகிச்சை சேவை"),
    PHARMACY_SERVICE(10, "Pharmacy Service", "மருந்தியல் சேவை"),
    HOUSEKEEPING(11, "Housekeeping / Hygienic Practices", "சுகாதார முறைகள்"),
    EXPECTED_COSTS_EXPLAINED(12, "Expected Costs are explained", "எதிர்பார்க்கப்படும் செலவுகளின் விளக்கம்"),
    TOILETS_CLEAN(13, "The Toilet(s) are clean", "கழிப்பறைகளின் தூய்மை"),
    PATIENT_RIGHTS_PROTECTED(14, "Patient's rights is protected", "நோயாளியின் உரிமைகள் பாதுகாக்கப்படுகின்றன"),
    FAMILY_EDUCATED(15, "Patients / Family Members are Educated in Decisions", "நோயாளிகள் / குடும்ப உறுப்பினர்கள் முடிவுகளில் விளக்கப்படுகின்றனர்"),
    HOSPITAL_BILLING(16, "The Hospital Billing is", "மருத்துவமனை கட்டணம்"),
    DISCHARGE_PROCESS(17, "Discharge Process", "வெளியேறும் முறை"),
    OVERALL_RATING(18, "Overall Rating", "ஒட்டுமொத்த மதிப்பீடு");

    private final int order;
    private final String english;
    private final String tamil;

    FeedbackQuestion(int order, String english, String tamil) {
        this.order   = order;
        this.english = english;
        this.tamil   = tamil;
    }

    public int getOrder()      { return order; }
    public String getEnglish() { return english; }
    public String getTamil()   { return tamil; }
}
