package com.hms.masters.service;

import com.hms.exception.DuplicateResourceException;
import com.hms.exception.ResourceNotFoundException;
import com.hms.masters.dto.InsuranceCompanyRequest;
import com.hms.masters.dto.InsuranceCompanyResponse;
import com.hms.masters.entity.InsuranceCompany;
import com.hms.masters.enums.Status;
import com.hms.masters.repository.InsuranceCompanyRepository;
import com.hms.modules.contact.dto.ContactRequest;
import com.hms.modules.contact.enums.ContactType;
import com.hms.modules.contact.service.ContactService;
import com.hms.common.AuditLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class InsuranceCompanyService {

    private final AuditLogService auditLogService;

    private final InsuranceCompanyRepository repo;
    private final ContactService contactService;

    @Transactional(readOnly = true)
    public List<InsuranceCompanyResponse> getAll() {
        return repo.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<InsuranceCompanyResponse> getActive() {
        return repo.findByStatus(Status.ACTIVE).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public InsuranceCompanyResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    public InsuranceCompanyResponse create(InsuranceCompanyRequest req) {
        log.info("[INS_CO] create name='{}'", req.getName());
        if (repo.existsByNameIgnoreCase(req.getName()))
            throw new DuplicateResourceException("Insurance company already exists: " + req.getName());

        InsuranceCompany ic = InsuranceCompany.builder()
                .companyCode(generateCode())
                .name(req.getName())
                .tpaName(resolvePrimaryTpa(req.getTpaName(), req.getTpaNames()))
                .tpaNames(joinTpaNames(req.getTpaNames()))
                .contactPerson(req.getContactPerson())
                .phone(req.getPhone())
                .email(req.getEmail())
                .address(req.getAddress())
                .tariffEffectiveFrom(req.getTariffEffectiveFrom())
                .tariffEffectiveTo(req.getTariffEffectiveTo())
                .status(req.getStatus())
                .build();
        InsuranceCompanyResponse saved = toResponse(repo.save(ic));
        log.info("[INS_CO] Created id={} code={}", saved.getId(), saved.getCompanyCode());
        auditLogService.log("InsuranceCompany", saved.getId(), "CREATE", currentUser(), "code=" + saved.getCompanyCode() + " name=" + saved.getName());

        // Auto-create contact entry
        try {
            ContactRequest contact = new ContactRequest();
            contact.setName(StringUtils.hasText(req.getContactPerson()) ? req.getContactPerson() : req.getName());
            contact.setType(ContactType.INSURANCE);
            contact.setPhone(StringUtils.hasText(req.getPhone()) ? req.getPhone() : "0000000000");
            contact.setEmail(req.getEmail());
            contact.setOrganization(req.getName());
            contact.setAddress(req.getAddress());
            String tpaNote = joinTpaNames(req.getTpaNames());
            if (!StringUtils.hasText(tpaNote)) tpaNote = req.getTpaName();
            contact.setNotes("TPA: " + (StringUtils.hasText(tpaNote) ? tpaNote : "N/A"));
            contactService.create(contact);
        } catch (Exception ignored) {
            // Best-effort; don't fail the insurance company save
        }

        return saved;
    }

    public InsuranceCompanyResponse update(Long id, InsuranceCompanyRequest req) {
        log.info("[INS_CO] update id={}", id);
        InsuranceCompany ic = findOrThrow(id);
        if (!ic.getName().equalsIgnoreCase(req.getName()) && repo.existsByNameIgnoreCase(req.getName()))
            throw new DuplicateResourceException("Company name already in use");

        ic.setName(req.getName());
        ic.setTpaName(resolvePrimaryTpa(req.getTpaName(), req.getTpaNames()));
        ic.setTpaNames(joinTpaNames(req.getTpaNames()));
        ic.setContactPerson(req.getContactPerson());
        ic.setPhone(req.getPhone());
        ic.setEmail(req.getEmail());
        ic.setAddress(req.getAddress());
        ic.setTariffEffectiveFrom(req.getTariffEffectiveFrom());
        ic.setTariffEffectiveTo(req.getTariffEffectiveTo());
        ic.setStatus(req.getStatus());
        InsuranceCompanyResponse icUpd = toResponse(repo.save(ic));
        auditLogService.log("InsuranceCompany", id, "UPDATE", currentUser(), "name=" + icUpd.getName());
        return icUpd;
    }

    public InsuranceCompanyResponse toggleStatus(Long id) {
        log.info("[INS_CO] toggleStatus id={}", id);
        InsuranceCompany ic = findOrThrow(id);
        Status icNewStatus = ic.getStatus() == Status.ACTIVE ? Status.INACTIVE : Status.ACTIVE;
        ic.setStatus(icNewStatus);
        InsuranceCompanyResponse icToggled = toResponse(repo.save(ic));
        auditLogService.log("InsuranceCompany", id, "TOGGLE_STATUS", currentUser(), "status=" + icNewStatus);
        return icToggled;

    }

    private InsuranceCompany findOrThrow(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("InsuranceCompany", id));
    }

    private String generateCode() {
        int seq = (repo.findMaxSequence() == null ? 0 : repo.findMaxSequence()) + 1;
        return String.format("INS%03d", seq);
    }

    // ── TPA name list <-> comma-separated storage helpers ─────────────────────

    /** Join the TPA list into a comma-separated string for storage. Null/empty → null. */
    private String joinTpaNames(java.util.List<String> names) {
        if (names == null || names.isEmpty()) return null;
        String joined = names.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .distinct()
                .collect(java.util.stream.Collectors.joining(", "));
        return StringUtils.hasText(joined) ? joined : null;
    }

    /**
     * Pick the primary (legacy) single TPA name to keep the {@code tpa_name}
     * column populated: an explicit tpaName wins, else the first of the list.
     */
    private String resolvePrimaryTpa(String tpaName, java.util.List<String> names) {
        if (StringUtils.hasText(tpaName)) return tpaName;
        if (names != null) {
            for (String n : names) {
                if (StringUtils.hasText(n)) return n.trim();
            }
        }
        return null;
    }

    /**
     * Split stored comma-separated TPA names into a list. Falls back to the
     * single legacy {@code tpaName} when the list column is empty so older rows
     * still surface their one TPA.
     */
    private java.util.List<String> splitTpaNames(String tpaNames, String legacyTpa) {
        if (StringUtils.hasText(tpaNames)) {
            return java.util.Arrays.stream(tpaNames.split(","))
                    .map(String::trim)
                    .filter(StringUtils::hasText)
                    .distinct()
                    .toList();
        }
        if (StringUtils.hasText(legacyTpa)) {
            return java.util.List.of(legacyTpa.trim());
        }
        return java.util.List.of();
    }

    private InsuranceCompanyResponse toResponse(InsuranceCompany ic) {
        InsuranceCompanyResponse r = new InsuranceCompanyResponse();
        r.setId(ic.getId());
        r.setCompanyCode(ic.getCompanyCode());
        r.setName(ic.getName());
        r.setTpaName(ic.getTpaName());
        r.setTpaNames(splitTpaNames(ic.getTpaNames(), ic.getTpaName()));
        r.setContactPerson(ic.getContactPerson());
        r.setPhone(ic.getPhone());
        r.setEmail(ic.getEmail());
        r.setAddress(ic.getAddress());
        r.setTariffEffectiveFrom(ic.getTariffEffectiveFrom());
        r.setTariffEffectiveTo(ic.getTariffEffectiveTo());
        r.setStatus(ic.getStatus());
        r.setCreatedBy(ic.getCreatedBy());
        r.setCreatedAt(ic.getCreatedAt());
        r.setUpdatedAt(ic.getUpdatedAt());
        return r;
    }

    private String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return "system";
        }
        return auth.getPrincipal().toString();
    }
}