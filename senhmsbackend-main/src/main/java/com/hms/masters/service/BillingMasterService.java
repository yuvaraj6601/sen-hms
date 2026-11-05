package com.hms.masters.service;

import com.hms.exception.ResourceNotFoundException;
import com.hms.masters.dto.BillingMasterRequest;
import com.hms.masters.dto.BillingMasterResponse;
import com.hms.masters.entity.BillingMaster;
import com.hms.masters.entity.BillingModality;
import com.hms.masters.enums.Status;
import com.hms.masters.repository.BillingMasterRepository;
import com.hms.masters.repository.BillingModalityRepository;
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
public class BillingMasterService {

    private final BillingMasterRepository repo;
    private final BillingModalityRepository modalityRepo;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public Page<BillingMasterResponse> search(String search, Long modalityId, Status status,
                                              Boolean showInOp, Pageable pageable) {
        return repo.search(
                StringUtils.hasText(search) ? search : null,
                modalityId, status, showInOp, pageable
        ).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public BillingMasterResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    public BillingMasterResponse create(BillingMasterRequest req) {
        log.info("[BILLING_MASTER] create name='{}' modalityId={}", req.getServiceName(), req.getModalityId());
        BillingModality modality = modalityRepo.findById(req.getModalityId())
                .orElseThrow(() -> new ResourceNotFoundException("BillingModality", req.getModalityId()));

        BillingMaster bm = BillingMaster.builder()
                .serviceCode(generateCode())
                .serviceName(req.getServiceName())
                .modality(modality)
                .price(req.getPrice())
                .discountAllowed(req.isDiscountAllowed())
                .showInOp(req.isShowInOp())
                .status(req.getStatus())
                .build();
        BillingMasterResponse bmSaved = toResponse(repo.save(bm));
        auditLogService.log("BillingMaster", bmSaved.getId(), "CREATE", currentUser(), "code=" + bmSaved.getServiceCode() + " name=" + bmSaved.getServiceName() + " price=" + bmSaved.getPrice());
        return bmSaved;
    }

    public BillingMasterResponse update(Long id, BillingMasterRequest req) {
        log.info("[BILLING_MASTER] update id={}", id);
        BillingMaster bm = findOrThrow(id);
        BillingModality modality = modalityRepo.findById(req.getModalityId())
                .orElseThrow(() -> new ResourceNotFoundException("BillingModality", req.getModalityId()));
        bm.setServiceName(req.getServiceName()); bm.setModality(modality);
        bm.setPrice(req.getPrice()); bm.setDiscountAllowed(req.isDiscountAllowed());
        bm.setShowInOp(req.isShowInOp());
        bm.setStatus(req.getStatus());
        BillingMasterResponse bmSaved = toResponse(repo.save(bm));
        auditLogService.log("BillingMaster", bmSaved.getId(), "CREATE", currentUser(), "code=" + bmSaved.getServiceCode() + " name=" + bmSaved.getServiceName() + " price=" + bmSaved.getPrice());
        return bmSaved;
    }

    public BillingMasterResponse toggleStatus(Long id) {
        log.info("[BILLING_MASTER] toggleStatus id={}", id);
        BillingMaster bm = findOrThrow(id);
        Status bmStatus = bm.getStatus() == Status.ACTIVE ? Status.INACTIVE : Status.ACTIVE;
        bm.setStatus(bmStatus);
        BillingMasterResponse bmToggled = toResponse(repo.save(bm));
        auditLogService.log("BillingMaster", id, "TOGGLE_STATUS", currentUser(), "status=" + bmStatus);
        return bmToggled;
    }

    private BillingMaster findOrThrow(Long id) {
        return repo.findById(id).orElseThrow(() -> new ResourceNotFoundException("BillingMaster", id));
    }

    private String generateCode() {
        int seq = (repo.findMaxSequence() == null ? 0 : repo.findMaxSequence()) + 1;
        return String.format("SVC%03d", seq);
    }

    private BillingMasterResponse toResponse(BillingMaster b) {
        BillingMasterResponse r = new BillingMasterResponse();
        r.setId(b.getId()); r.setServiceCode(b.getServiceCode());
        r.setServiceName(b.getServiceName());
        r.setModalityId(b.getModality().getId());
        r.setModalityName(b.getModality().getName());
        r.setModalityCode(b.getModality().getModalityCode());
        r.setPrice(b.getPrice()); r.setDiscountAllowed(b.isDiscountAllowed());
        r.setShowInOp(b.isShowInOp());
        r.setStatus(b.getStatus());
        r.setCreatedBy(b.getCreatedBy()); r.setCreatedAt(b.getCreatedAt()); r.setUpdatedAt(b.getUpdatedAt());
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