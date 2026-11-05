package com.hms.masters.service;

import com.hms.exception.ResourceNotFoundException;
import com.hms.masters.dto.ReferrerRequest;
import com.hms.masters.dto.ReferrerResponse;
import com.hms.masters.entity.Referrer;
import com.hms.masters.enums.ReferrerType;
import com.hms.masters.enums.Status;
import com.hms.masters.repository.ReferrerRepository;
import com.hms.modules.contact.dto.ContactRequest;
import com.hms.modules.contact.enums.ContactType;
import com.hms.modules.contact.service.ContactService;
import com.hms.common.AuditLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class ReferrerService {

    private final ReferrerRepository repo;
    private final ContactService contactService;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public Page<ReferrerResponse> search(String search, ReferrerType type, Status status, Pageable pageable) {
        return repo.search(
                StringUtils.hasText(search) ? search : null,
                type, status, pageable
        ).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public ReferrerResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    public ReferrerResponse create(ReferrerRequest req) {
        log.info("[REFERRER] create name='{}' type={}", req.getName(), req.getType());
        Referrer r = Referrer.builder()
                .name(req.getName()).type(req.getType())
                .specialization(req.getSpecialization())
                .organization(req.getOrganization())
                .phone(req.getPhone()).alternatePhone(req.getAlternatePhone())
                .address(req.getAddress()).notes(req.getNotes())
                .status(req.getStatus()).totalReferrals(0)
                .build();
        ReferrerResponse saved = toResponse(repo.save(r));
        log.info("[REFERRER] Created id={} name='{}'", saved.getId(), saved.getName());
        auditLogService.log("Referrer", saved.getId(), "CREATE", currentUser(), "name=" + saved.getName() + " type=" + saved.getType());

        // Auto-create contact entry
        try {
            ContactRequest contact = new ContactRequest();
            contact.setName(req.getName());
            contact.setType(ContactType.OTHER);
            contact.setPhone(req.getPhone());
            contact.setOrganization(req.getOrganization());
            contact.setAddress(req.getAddress());
            contact.setNotes(req.getNotes());
            contactService.create(contact);
        } catch (Exception ignored) {
            // Best-effort; don't fail the referrer save
        }

        return saved;
    }

    public ReferrerResponse update(Long id, ReferrerRequest req) {
        log.info("[REFERRER] update id={}", id);
        Referrer r = findOrThrow(id);
        r.setName(req.getName()); r.setType(req.getType());
        r.setSpecialization(req.getSpecialization());
        r.setOrganization(req.getOrganization());
        r.setPhone(req.getPhone()); r.setAlternatePhone(req.getAlternatePhone());
        r.setAddress(req.getAddress()); r.setNotes(req.getNotes());
        r.setStatus(req.getStatus());
        ReferrerResponse rUpd = toResponse(repo.save(r));
        auditLogService.log("Referrer", id, "UPDATE", currentUser(), "name=" + rUpd.getName());
        return rUpd;
    }

    public ReferrerResponse toggleStatus(Long id) {
        log.info("[REFERRER] toggleStatus id={}", id);
        Referrer r = findOrThrow(id);
        Status refNewStatus = r.getStatus() == Status.ACTIVE ? Status.INACTIVE : Status.ACTIVE;
        r.setStatus(refNewStatus);
        ReferrerResponse refToggled = toResponse(repo.save(r));
        auditLogService.log("Referrer", id, "TOGGLE_STATUS", currentUser(), "status=" + refNewStatus);
        return refToggled;

    }

    private Referrer findOrThrow(Long id) {
        return repo.findById(id).orElseThrow(() -> new ResourceNotFoundException("Referrer", id));
    }

    private ReferrerResponse toResponse(Referrer r) {
        ReferrerResponse res = new ReferrerResponse();
        res.setId(r.getId()); res.setName(r.getName()); res.setType(r.getType());
        res.setSpecialization(r.getSpecialization()); res.setOrganization(r.getOrganization());
        res.setPhone(r.getPhone()); res.setAlternatePhone(r.getAlternatePhone());
        res.setAddress(r.getAddress()); res.setNotes(r.getNotes());
        res.setTotalReferrals(r.getTotalReferrals()); res.setStatus(r.getStatus());
        res.setCreatedBy(r.getCreatedBy()); res.setCreatedAt(r.getCreatedAt()); res.setUpdatedAt(r.getUpdatedAt());
        return res;
    }

    private String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return "system";
        }
        return auth.getPrincipal().toString();
    }
}