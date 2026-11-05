package com.hms.modules.settings.entity;

import com.hms.common.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "hospital_settings")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class HospitalSettings extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ── Hospital identity ─────────────────────────────────────────────────────
    @Column(name = "hospital_name", nullable = false, length = 200)
    private String hospitalName;

    @Column(name = "hospital_name_secondary", length = 200)
    private String hospitalNameSecondary;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(length = 100)
    private String city;

    @Column(length = 100)
    private String state;

    @Column(name = "pin_code", length = 10)
    private String pinCode;

    @Column(length = 20)
    private String phone;

    @Column(name = "alternate_phone", length = 20)
    private String alternatePhone;

    @Column(length = 100)
    private String email;

    @Column(length = 100)
    private String website;

    // ── Registration / Tax ────────────────────────────────────────────────────
    @Column(name = "gst_no", length = 50)
    private String gstNo;

    @Column(name = "reg_no", length = 100)
    private String regNo;

    @Column(name = "dl_no", length = 100)
    private String dlNo;

    // ── Bill settings (stored as JSON text) ───────────────────────────────────
    @Column(name = "bill_settings_json", columnDefinition = "TEXT")
    private String billSettingsJson;

    // ── Document settings ─────────────────────────────────────────────────────
    @Column(name = "document_settings_json", columnDefinition = "TEXT")
    private String documentSettingsJson;

    // ── Watermark settings ────────────────────────────────────────────────────
    @Column(name = "watermark_settings_json", columnDefinition = "TEXT")
    private String watermarkSettingsJson;
}
