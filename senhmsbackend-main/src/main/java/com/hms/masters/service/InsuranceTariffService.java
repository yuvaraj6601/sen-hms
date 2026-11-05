package com.hms.masters.service;

import com.hms.masters.dto.InsuranceTariffBulkRequest;
import com.hms.masters.dto.InsuranceTariffRequest;
import com.hms.masters.dto.InsuranceTariffResponse;
import com.hms.masters.dto.InsurerCodeRateRequest;
import com.hms.masters.entity.BillingMaster;
import com.hms.masters.entity.InsuranceCompany;
import com.hms.masters.entity.InsuranceTariff;
import com.hms.masters.entity.Investigation;
import com.hms.masters.entity.Ward;
import com.hms.masters.enums.Status;
import com.hms.masters.repository.BillingMasterRepository;
import com.hms.masters.repository.InsuranceCompanyRepository;
import com.hms.masters.repository.InsuranceTariffRepository;
import com.hms.masters.repository.InvestigationRepository;
import com.hms.masters.repository.WardRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class InsuranceTariffService {

    private final InsuranceTariffRepository  tariffRepo;
    private final InsuranceCompanyRepository companyRepo;
    private final BillingMasterRepository    billingMasterRepo;
    private final InvestigationRepository    investigationRepo;
    private final WardRepository             wardRepo;

    // Source type constants
    private static final String SRC_BILLING = "BILLING";
    private static final String SRC_LAB     = "LAB";
    private static final String SRC_ROOM    = "ROOM";
    private static final String SRC_CUSTOM  = "CUSTOM";

    // Stable code prefix for ward-based tariff rows: WARD-{wardCode}
    private static final String WARD_PREFIX = "WARD-";

    // ── Read ─────────────────────────────────────────────────────────────────

    /**
     * Returns the full billable catalogue for the tariff editor, merged from
     * three masters (billing_masters, investigations, wards) plus any manual
     * CUSTOM rows, each annotated with the insurer's saved tariff (if any).
     *
     * A "catalogue row" is a service the hospital can bill.  Where a saved
     * InsuranceTariff exists for it, tariffPrice/excluded/id are filled in;
     * otherwise the row is returned unpriced (hospitalRate only) so the UI
     * can show it and let the user set a rate.
     *
     * This is what makes newly-added lab tests / wards appear automatically.
     */
    @Transactional(readOnly = true)
    public List<InsuranceTariffResponse> getByCompany(Long insuranceCompanyId, String search) {
        InsuranceCompany company = findCompanyOrThrow(insuranceCompanyId);

        // 1. Load existing saved tariff rows for this insurer, keyed by service code.
        Map<String, InsuranceTariff> saved = new LinkedHashMap<>();
        tariffRepo.findByInsuranceCompanyIdOrderByModalityNameAscServiceNameAsc(insuranceCompanyId)
                .forEach(t -> saved.put(t.getServiceCode(), t));

        // 2. Build the merged catalogue keyed by service code (insertion order preserved).
        Map<String, InsuranceTariffResponse> catalogue = new LinkedHashMap<>();

        // 2a. Billing masters (consultations, OT, procedures, scans, seeded rooms, etc.)
        for (BillingMaster b : billingMasterRepo.findByStatus(Status.ACTIVE)) {
            catalogue.put(b.getServiceCode(), baseRow(
                    company, b.getServiceCode(), b.getServiceName(),
                    b.getModality() != null ? b.getModality().getName() : "Service",
                    SRC_BILLING, b.getPrice()));
        }

        // 2b. Lab investigations — keyed by their own testCode (LAB###)
        for (Investigation inv : investigationRepo.findByStatus(Status.ACTIVE)) {
            catalogue.put(inv.getTestCode(), baseRow(
                    company, inv.getTestCode(), inv.getName(),
                    StringUtils.hasText(inv.getCategory()) ? "Lab — " + inv.getCategory() : "Lab",
                    SRC_LAB, inv.getPrice()));
        }

        // 2c. Wards — keyed by WARD-{wardCode}; hospital rate = chargePerDay
        for (Ward w : wardRepo.findByStatus(Status.ACTIVE)) {
            String code = WARD_PREFIX + w.getWardCode();
            BigDecimal rate = w.getChargePerDay() != null
                    ? BigDecimal.valueOf(w.getChargePerDay()) : null;
            catalogue.put(code, baseRow(
                    company, code, w.getName() + " (per day)",
                    StringUtils.hasText(w.getWardType()) ? "Room — " + w.getWardType() : "Room",
                    SRC_ROOM, rate));
        }

        // 3. Overlay saved tariff values onto matching catalogue rows.
        //    Any saved row whose code is NOT in the catalogue is a CUSTOM row
        //    (insurer-only item, or a master that was since removed) — include it too.
        for (InsuranceTariff t : saved.values()) {
            InsuranceTariffResponse row = catalogue.get(t.getServiceCode());
            if (row == null) {
                // Manual / orphaned row — surface it as its stored sourceType (default CUSTOM)
                row = new InsuranceTariffResponse();
                row.setServiceCode(t.getServiceCode());
                row.setServiceName(t.getServiceName());
                row.setModalityName(t.getModalityName());
                row.setSourceType(StringUtils.hasText(t.getSourceType()) ? t.getSourceType() : SRC_CUSTOM);
                row.setHospitalRate(null);
                catalogue.put(t.getServiceCode(), row);
            }
            row.setId(t.getId());
            row.setTariffPrice(t.getTariffPrice());
            row.setExcluded(t.isExcluded());
            if (StringUtils.hasText(t.getCategory())) row.setCategory(t.getCategory());
            row.setInsurerCode(t.getInsurerCode());
            row.setInsurerDescription(t.getInsurerDescription());
            row.setEffectiveFrom(t.getEffectiveFrom());
            row.setEffectiveTo(t.getEffectiveTo());
            row.setNotes(t.getNotes());
            row.setCreatedBy(t.getCreatedBy());
            row.setCreatedAt(t.getCreatedAt());
            row.setUpdatedAt(t.getUpdatedAt());
        }

        // 4. Optional search filter (name / code / modality).
        List<InsuranceTariffResponse> rows = new ArrayList<>(catalogue.values());
        if (StringUtils.hasText(search)) {
            String q = search.toLowerCase();
            rows.removeIf(r ->
                    !(safe(r.getServiceName()).contains(q)
                      || safe(r.getServiceCode()).contains(q)
                      || safe(r.getModalityName()).contains(q)));
        }
        return rows;
    }

    /** Single service lookup — used for per-item price check */
    @Transactional(readOnly = true)
    public InsuranceTariffResponse getByCompanyAndService(Long insuranceCompanyId, String serviceCode) {
        InsuranceTariff t = tariffRepo
                .findByInsuranceCompanyIdAndServiceCode(insuranceCompanyId, serviceCode)
                .orElseThrow(() -> new IllegalArgumentException(
                        "No tariff found for company=" + insuranceCompanyId + " service=" + serviceCode));
        return toResponse(t, hospitalRateFor(serviceCode));
    }

    @Transactional(readOnly = true)
    public InsuranceTariffResponse getById(Long id) {
        InsuranceTariff t = findOrThrow(id);
        return toResponse(t, hospitalRateFor(t.getServiceCode()));
    }

    // ── Write ────────────────────────────────────────────────────────────────

    /**
     * Create a single tariff row. Supports:
     *   - BILLING/LAB/ROOM: code must resolve to a master (name snapshot pulled from it)
     *   - CUSTOM: user-supplied code + name, NOT validated against any master
     */
    @Transactional
    public InsuranceTariffResponse create(InsuranceTariffRequest req) {
        System.out.println("Trrif create");
        InsuranceCompany company = findCompanyOrThrow(req.getInsuranceCompanyId());

        if (tariffRepo.existsByInsuranceCompanyIdAndServiceCode(
                req.getInsuranceCompanyId(), req.getServiceCode())) {
            throw new IllegalArgumentException(
                    "Tariff already exists for " + company.getName() + " / " + req.getServiceCode()
                    + ". Use PUT to update it.");
        }

        Resolved r = resolve(req.getSourceType(), req.getServiceCode(),
                req.getServiceName(), req.getModalityName());

        InsuranceTariff t = InsuranceTariff.builder()
                .insuranceCompanyId(company.getId())
                .insuranceCompanyName(company.getName())
                .serviceCode(r.code)
                .serviceName(r.name)
                .modalityName(r.modality)
                .sourceType(r.sourceType)
                .category(StringUtils.hasText(req.getCategory()) ? req.getCategory() : r.modality)
                .insurerCode(req.getInsurerCode())
                .insurerDescription(req.getInsurerDescription())
                .tariffPrice(req.isExcluded() ? BigDecimal.ZERO : req.getTariffPrice())
                .excluded(req.isExcluded())
                .effectiveFrom(req.getEffectiveFrom())
                .effectiveTo(req.getEffectiveTo())
                .notes(req.getNotes())
                .build();

        InsuranceTariff saved = tariffRepo.save(t);
        log.info("[TARIFF] Created id={} company='{}' service='{}' src={} price={}",
                saved.getId(), company.getName(), r.code, r.sourceType, saved.getTariffPrice());
        return toResponse(saved, r.hospitalRate);
    }

    /** Update an existing tariff row */
    @Transactional
    public InsuranceTariffResponse update(Long id, InsuranceTariffRequest req) {
        System.out.println("Trrif update");
        InsuranceTariff  t       = findOrThrow(id);
        InsuranceCompany company = findCompanyOrThrow(req.getInsuranceCompanyId());

        if (!t.getInsuranceCompanyId().equals(req.getInsuranceCompanyId())
                || !t.getServiceCode().equals(req.getServiceCode())) {
            if (tariffRepo.existsByInsuranceCompanyIdAndServiceCode(
                    req.getInsuranceCompanyId(), req.getServiceCode())) {
                throw new IllegalArgumentException(
                        "Tariff already exists for " + company.getName() + " / " + req.getServiceCode());
            }
        }

        Resolved r = resolve(req.getSourceType(), req.getServiceCode(),
                req.getServiceName(), req.getModalityName());

        t.setInsuranceCompanyId(company.getId());
        t.setInsuranceCompanyName(company.getName());
        t.setServiceCode(r.code);
        t.setServiceName(r.name);
        t.setModalityName(r.modality);
        t.setSourceType(r.sourceType);
        t.setCategory(StringUtils.hasText(req.getCategory()) ? req.getCategory() : r.modality);
        t.setInsurerCode(req.getInsurerCode());
        t.setInsurerDescription(req.getInsurerDescription());
        t.setTariffPrice(req.isExcluded() ? BigDecimal.ZERO : req.getTariffPrice());
        t.setExcluded(req.isExcluded());
        t.setEffectiveFrom(req.getEffectiveFrom());
        t.setEffectiveTo(req.getEffectiveTo());
        t.setNotes(req.getNotes());

        InsuranceTariff saved = tariffRepo.save(t);
        log.info("[TARIFF] Updated id={} company='{}' service='{}' price={}",
                saved.getId(), company.getName(), r.code, saved.getTariffPrice());
        return toResponse(saved, r.hospitalRate);
    }

    /**
     * Change the tariff price for EVERY row that shares one insurer code
     * (a price group) under a company. One edit → all mapped services update.
     * Excluded rows are left at 0 (still not covered).
     * Returns the updated rows.
     */
    @Transactional
    public List<InsuranceTariffResponse> updateRateByInsurerCode(InsurerCodeRateRequest req) {
        System.out.println("Trrif updateRateByInsurerCode");
        InsuranceCompany company = findCompanyOrThrow(req.getInsuranceCompanyId());
        List<InsuranceTariff> rows = tariffRepo
                .findByInsuranceCompanyIdAndInsurerCode(company.getId(), req.getInsurerCode());
        if (rows.isEmpty()) {
            throw new IllegalArgumentException(
                    "No tariff rows found for insurer code '" + req.getInsurerCode() + "'");
        }
        for (InsuranceTariff t : rows) {
            if (!t.isExcluded()) {
                t.setTariffPrice(req.getTariffPrice());
            }
        }
        List<InsuranceTariff> saved = tariffRepo.saveAll(rows);
        log.info("[TARIFF] Rate change by insurer code='{}' company='{}' rows={} newPrice={}",
                req.getInsurerCode(), company.getName(), saved.size(), req.getTariffPrice());
        return saved.stream()
                .map(t -> toResponse(t, hospitalRateFor(t.getServiceCode())))
                .toList();
    }

    /** Delete a tariff row — billing falls back to the source rate for that service */
    @Transactional
    public void delete(Long id) {
        InsuranceTariff t = findOrThrow(id);
        log.info("[TARIFF] Deleted id={} company='{}' service='{}'",
                id, t.getInsuranceCompanyName(), t.getServiceCode());
        tariffRepo.delete(t);
    }

    /**
     * Bulk upsert — all rows belong to the same company.
     * Each item may carry its own sourceType; unknown non-CUSTOM codes are skipped
     * with a warning, CUSTOM rows are created from the supplied name.
     */
    @Transactional
    public List<InsuranceTariffResponse> bulkUpsert(InsuranceTariffBulkRequest req) {
        InsuranceCompany company = findCompanyOrThrow(req.getInsuranceCompanyId());

        Map<String, InsuranceTariff> existing = new LinkedHashMap<>();
        tariffRepo.findByInsuranceCompanyIdOrderByModalityNameAscServiceNameAsc(company.getId())
                .forEach(t -> existing.put(t.getServiceCode(), t));

        List<InsuranceTariff> toSave = new ArrayList<>();
        List<BigDecimal>      hospRates = new ArrayList<>();

        for (InsuranceTariffBulkRequest.BulkItem item : req.getItems()) {
            Resolved r;
            try {
                r = resolve(item.getSourceType(), item.getServiceCode(),
                        item.getServiceName(), item.getModalityName());
            } catch (IllegalArgumentException ex) {
                log.warn("[TARIFF] Bulk upsert skipped code={}: {}", item.getServiceCode(), ex.getMessage());
                continue;
            }

            InsuranceTariff t = existing.getOrDefault(r.code,
                    InsuranceTariff.builder()
                            .insuranceCompanyId(company.getId())
                            .insuranceCompanyName(company.getName())
                            .build());

            t.setServiceCode(r.code);
            t.setServiceName(r.name);
            t.setModalityName(r.modality);
            t.setSourceType(r.sourceType);
            if (StringUtils.hasText(item.getCategory()))           t.setCategory(item.getCategory());
            else if (!StringUtils.hasText(t.getCategory()))        t.setCategory(r.modality);
            if (StringUtils.hasText(item.getInsurerCode()))        t.setInsurerCode(item.getInsurerCode());
            if (StringUtils.hasText(item.getInsurerDescription())) t.setInsurerDescription(item.getInsurerDescription());
            t.setTariffPrice(item.isExcluded() ? BigDecimal.ZERO : item.getTariffPrice());
            t.setExcluded(item.isExcluded());
            if (StringUtils.hasText(item.getNotes())) t.setNotes(item.getNotes());
            toSave.add(t);
            hospRates.add(r.hospitalRate);
        }

        List<InsuranceTariff> saved = tariffRepo.saveAll(toSave);
        log.info("[TARIFF] Bulk upsert company='{}' rows={}", company.getName(), saved.size());

        List<InsuranceTariffResponse> out = new ArrayList<>();
        for (int i = 0; i < saved.size(); i++) {
            out.add(toResponse(saved.get(i), hospRates.get(i)));
        }
        return out;
    }

    // ── Resolution of a code → (name, modality, sourceType, hospitalRate) ──────

    /** Result of resolving a tariff row's identity against its source master. */
    private static final class Resolved {
        String code; String name; String modality; String sourceType; BigDecimal hospitalRate;
        Resolved(String code, String name, String modality, String sourceType, BigDecimal hospitalRate) {
            this.code = code; this.name = name; this.modality = modality;
            this.sourceType = sourceType; this.hospitalRate = hospitalRate;
        }
    }

    /**
     * Resolves the display name / modality / hospital rate for a tariff row
     * based on its sourceType and code.
     * CUSTOM rows are accepted as-is (name required, no master lookup).
     */
    private Resolved resolve(String sourceType, String code, String name, String modality) {
        String src = StringUtils.hasText(sourceType) ? sourceType.toUpperCase() : SRC_BILLING;

        switch (src) {
            case SRC_LAB -> {
                Investigation inv = investigationRepo.findAll().stream()
                        .filter(i -> code.equals(i.getTestCode())).findFirst()
                        .orElseThrow(() -> new IllegalArgumentException("Lab test not found: " + code));
                return new Resolved(code, inv.getName(),
                        StringUtils.hasText(inv.getCategory()) ? "Lab — " + inv.getCategory() : "Lab",
                        SRC_LAB, inv.getPrice());
            }
            case SRC_ROOM -> {
                String wardCode = code.startsWith(WARD_PREFIX) ? code.substring(WARD_PREFIX.length()) : code;
                Ward w = wardRepo.findAll().stream()
                        .filter(x -> wardCode.equals(x.getWardCode())).findFirst()
                        .orElseThrow(() -> new IllegalArgumentException("Ward not found: " + code));
                BigDecimal rate = w.getChargePerDay() != null ? BigDecimal.valueOf(w.getChargePerDay()) : null;
                return new Resolved(WARD_PREFIX + w.getWardCode(), w.getName() + " (per day)",
                        StringUtils.hasText(w.getWardType()) ? "Room — " + w.getWardType() : "Room",
                        SRC_ROOM, rate);
            }
            case SRC_CUSTOM -> {
                if (!StringUtils.hasText(name)) {
                    throw new IllegalArgumentException("Custom tariff requires a service name");
                }
                return new Resolved(code, name.trim(),
                        StringUtils.hasText(modality) ? modality.trim() : "Custom",
                        SRC_CUSTOM, null);
            }
            default -> {
                // BILLING
                BillingMaster b = billingMasterRepo.findByServiceCode(code)
                        .orElseThrow(() -> new IllegalArgumentException("Service not found: " + code));
                return new Resolved(b.getServiceCode(), b.getServiceName(),
                        b.getModality() != null ? b.getModality().getName() : "Service",
                        SRC_BILLING, b.getPrice());
            }
        }
    }

    /** Best-effort hospital rate lookup by code across all three sources. */
    private BigDecimal hospitalRateFor(String code) {
        if (code == null) return null;
        if (code.startsWith(WARD_PREFIX)) {
            String wc = code.substring(WARD_PREFIX.length());
            return wardRepo.findAll().stream()
                    .filter(w -> wc.equals(w.getWardCode())).findFirst()
                    .map(w -> w.getChargePerDay() != null ? BigDecimal.valueOf(w.getChargePerDay()) : null)
                    .orElse(null);
        }
        BigDecimal billing = billingMasterRepo.findByServiceCode(code)
                .map(BillingMaster::getPrice).orElse(null);
        if (billing != null) return billing;
        return investigationRepo.findAll().stream()
                .filter(i -> code.equals(i.getTestCode())).findFirst()
                .map(Investigation::getPrice).orElse(null);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private InsuranceTariffResponse baseRow(InsuranceCompany company, String code, String name,
                                            String modality, String sourceType, BigDecimal hospitalRate) {
        return InsuranceTariffResponse.builder()
                .insuranceCompanyId(company.getId())
                .insuranceCompanyName(company.getName())
                .serviceCode(code)
                .serviceName(name)
                .modalityName(modality)
                .sourceType(sourceType)
                .category(modality)   // default grouping label; overridden by saved tariff category
                .hospitalRate(hospitalRate)
                .tariffPrice(null)   // unpriced until a tariff row is saved
                .excluded(false)
                .build();
    }

    private String safe(String s) { return s == null ? "" : s.toLowerCase(); }

    private InsuranceTariff findOrThrow(Long id) {
        return tariffRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Insurance tariff not found: " + id));
    }

    private InsuranceCompany findCompanyOrThrow(Long id) {
        return companyRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Insurance company not found: " + id));
    }

    private InsuranceTariffResponse toResponse(InsuranceTariff t, BigDecimal hospitalRate) {
        return InsuranceTariffResponse.builder()
                .id(t.getId())
                .insuranceCompanyId(t.getInsuranceCompanyId())
                .insuranceCompanyName(t.getInsuranceCompanyName())
                .serviceCode(t.getServiceCode())
                .serviceName(t.getServiceName())
                .modalityName(t.getModalityName())
                .sourceType(StringUtils.hasText(t.getSourceType()) ? t.getSourceType() : SRC_BILLING)
                .category(StringUtils.hasText(t.getCategory()) ? t.getCategory() : t.getModalityName())
                .insurerCode(t.getInsurerCode())
                .insurerDescription(t.getInsurerDescription())
                .hospitalRate(hospitalRate)
                .tariffPrice(t.getTariffPrice())
                .excluded(t.isExcluded())
                .effectiveFrom(t.getEffectiveFrom())
                .effectiveTo(t.getEffectiveTo())
                .notes(t.getNotes())
                .createdBy(t.getCreatedBy())
                .createdAt(t.getCreatedAt())
                .updatedAt(t.getUpdatedAt())
                .build();
    }
}
