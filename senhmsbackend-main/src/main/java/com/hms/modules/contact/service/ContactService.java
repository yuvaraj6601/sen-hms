package com.hms.modules.contact.service;

import com.hms.exception.ResourceNotFoundException;
import com.hms.modules.contact.dto.ContactRequest;
import com.hms.modules.contact.dto.ContactResponse;
import com.hms.modules.contact.entity.Contact;
import com.hms.modules.contact.enums.ContactType;
import com.hms.modules.contact.repository.ContactRepository;
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
public class ContactService {

    private final ContactRepository repo;
    private final AuditLogService auditLogService;
    @Transactional(readOnly = true)
    public Page<ContactResponse> search(String search, ContactType type, Pageable pageable) {
        return repo.search(
                StringUtils.hasText(search) ? search : null,
                type,
                pageable
        ).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public ContactResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    public ContactResponse create(ContactRequest req) {
        log.info("[CONTACT] create name='{}' type={}", req.getName(), req.getType());
        Contact c = Contact.builder()
                .name(req.getName())
                .type(req.getType())
                .phone(req.getPhone())
                .email(req.getEmail())
                .organization(req.getOrganization())
                .address(req.getAddress())
                .area(req.getArea())
                .district(req.getDistrict())
                .notes(req.getNotes())
                .build();
        ContactResponse cSaved = toResponse(repo.save(c));
        auditLogService.log("Contact", cSaved.getId(), "CREATE", currentUser(), "name=" + cSaved.getName() + " type=" + cSaved.getType());
        return cSaved;
    }

    public ContactResponse update(Long id, ContactRequest req) {
        log.info("[CONTACT] update id={} name='{}'", id, req.getName());
        Contact c = findOrThrow(id);
        c.setName(req.getName());
        c.setType(req.getType());
        c.setPhone(req.getPhone());
        c.setEmail(req.getEmail());
        c.setOrganization(req.getOrganization());
        c.setAddress(req.getAddress());
        c.setArea(req.getArea());
        c.setDistrict(req.getDistrict());
        c.setNotes(req.getNotes());
        ContactResponse cSaved = toResponse(repo.save(c));
        auditLogService.log("Contact", cSaved.getId(), "CREATE", currentUser(), "name=" + cSaved.getName() + " type=" + cSaved.getType());
        return cSaved;
    }

    public void delete(Long id) {
        log.info("[CONTACT] delete id={}", id);
        Contact toDelete = findOrThrow(id);
        repo.delete(toDelete);
        auditLogService.log("Contact", id, "DELETE", currentUser(), "name=" + toDelete.getName());
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private Contact findOrThrow(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Contact", id));
    }

    private ContactResponse toResponse(Contact c) {
        ContactResponse r = new ContactResponse();
        r.setId(c.getId());
        r.setName(c.getName());
        r.setType(c.getType());
        r.setPhone(c.getPhone());
        r.setEmail(c.getEmail());
        r.setOrganization(c.getOrganization());
        r.setAddress(c.getAddress());
        r.setArea(c.getArea());
        r.setDistrict(c.getDistrict());
        r.setNotes(c.getNotes());
        r.setCreatedBy(c.getCreatedBy());
        r.setCreatedAt(c.getCreatedAt());
        r.setUpdatedAt(c.getUpdatedAt());
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