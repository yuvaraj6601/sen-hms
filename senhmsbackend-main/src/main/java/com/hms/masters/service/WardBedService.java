package com.hms.masters.service;

import com.hms.common.AuditLogService;
import com.hms.exception.DuplicateResourceException;
import com.hms.exception.ResourceNotFoundException;
import com.hms.masters.dto.BedRequest;
import com.hms.masters.dto.BedResponse;
import com.hms.masters.dto.WardRequest;
import com.hms.masters.dto.WardResponse;
import com.hms.masters.entity.Bed;
import com.hms.masters.entity.Bed.BedStatus;
import com.hms.masters.entity.Department;
import com.hms.masters.entity.Ward;
import com.hms.masters.enums.Status;
import com.hms.masters.repository.BedRepository;
import com.hms.masters.repository.DepartmentRepository;
import com.hms.masters.repository.WardRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class WardBedService {

    private final WardRepository wardRepo;
    private final BedRepository bedRepo;
    private final DepartmentRepository deptRepo;
    private final AuditLogService auditLogService;

    // ── Wards ─────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<WardResponse> getAllWards() {
        return wardRepo.findAll().stream().map(this::toWardResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<WardResponse> getActiveWards() {
        return wardRepo.findByStatus(Status.ACTIVE).stream().map(this::toWardResponse).toList();
    }

    @Transactional(readOnly = true)
    public WardResponse getWardById(Long id) {
        return toWardResponse(findWardOrThrow(id));
    }

    public WardResponse createWard(WardRequest req) {
        log.info("[WARD] Creating ward name='{}' type={} beds={}", req.getName(), req.getWardType(), req.getTotalBeds());
        Department dept = deptRepo.findById(req.getDepartmentId())
                .orElseThrow(() -> new ResourceNotFoundException("Department", req.getDepartmentId()));

        Ward ward = Ward.builder()
                .wardCode(generateWardCode())
                .name(req.getName())
                .wardType(req.getWardType())
                .department(dept)
                .totalBeds(req.getTotalBeds())
                .occupiedBeds(0)
                .chargePerDay(req.getChargePerDay())
                .status(req.getStatus())
                .build();
        Ward saved = wardRepo.save(ward);

        // Auto-create beds
        List<Bed> beds = new ArrayList<>();
        for (int i = 1; i <= req.getTotalBeds(); i++) {
            beds.add(Bed.builder()
                    .number(String.format("%s-%02d", saved.getWardCode(), i))
                    .ward(saved)
                    .status(BedStatus.AVAILABLE)
                    .build());
        }
        bedRepo.saveAll(beds);

        log.info("[WARD] Created wardCode={} id={} beds={}", saved.getWardCode(), saved.getId(), req.getTotalBeds());
        auditLogService.log("Ward", saved.getId(), "CREATE", currentUser(),
                "wardCode=" + saved.getWardCode() + " name=" + saved.getName() + " beds=" + req.getTotalBeds());
        return toWardResponse(saved);
    }

    public WardResponse updateWard(Long id, WardRequest req) {
        log.info("[WARD] Updating id={} name='{}'", id, req.getName());
        Ward ward = findWardOrThrow(id);
        Department dept = deptRepo.findById(req.getDepartmentId())
                .orElseThrow(() -> new ResourceNotFoundException("Department", req.getDepartmentId()));

        ward.setName(req.getName());
        ward.setWardType(req.getWardType());
        ward.setDepartment(dept);
        ward.setTotalBeds(req.getTotalBeds());
        ward.setChargePerDay(req.getChargePerDay());
        ward.setStatus(req.getStatus());
        Ward saved = wardRepo.save(ward);
        auditLogService.log("Ward", id, "UPDATE", currentUser(),
                "name=" + saved.getName() + " status=" + saved.getStatus());
        return toWardResponse(saved);
    }

    public WardResponse toggleWardStatus(Long id) {
        Ward ward = findWardOrThrow(id);
        Status newStatus = ward.getStatus() == Status.ACTIVE ? Status.INACTIVE : Status.ACTIVE;
        ward.setStatus(newStatus);
        Ward saved = wardRepo.save(ward);
        log.info("[WARD] ToggleStatus id={} wardCode={} status={}", id, saved.getWardCode(), newStatus);
        auditLogService.log("Ward", id, "TOGGLE_STATUS", currentUser(),
                "wardCode=" + saved.getWardCode() + " status=" + newStatus);
        return toWardResponse(saved);
    }

    // ── Beds ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<BedResponse> getBedsByWard(Long wardId) {
        return bedRepo.findByWard_Id(wardId).stream().map(this::toBedResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<BedResponse> getAvailableBedsByWard(Long wardId) {
        return bedRepo.findByWard_IdAndStatus(wardId, BedStatus.AVAILABLE)
                .stream().map(this::toBedResponse).toList();
    }

    public BedResponse addBed(BedRequest req) {
        log.info("[BED] addBed wardId={} number='{}'", req.getWardId(), req.getNumber());
        Ward ward = wardRepo.findById(req.getWardId())
                .orElseThrow(() -> new ResourceNotFoundException("Ward", req.getWardId()));

        if (bedRepo.existsByNumberAndWard_Id(req.getNumber(), req.getWardId()))
            throw new DuplicateResourceException(
                    "Bed number " + req.getNumber() + " already exists in this ward");

        Bed bed = Bed.builder()
                .number(req.getNumber())
                .ward(ward)
                .status(req.getStatus() != null ? req.getStatus() : BedStatus.AVAILABLE)
                .build();

        // Update ward total
        ward.setTotalBeds(ward.getTotalBeds() + 1);
        wardRepo.save(ward);

        Bed saved = bedRepo.save(bed);
        auditLogService.log("Bed", saved.getId(), "CREATE", currentUser(),
                "number=" + saved.getNumber() + " wardId=" + req.getWardId());
        return toBedResponse(saved);
    }

    public void deleteBed(Long bedId) {
        log.info("[BED] deleteBed id={}", bedId);
        Bed bed = bedRepo.findById(bedId)
                .orElseThrow(() -> new ResourceNotFoundException("Bed", bedId));
        if (bed.getStatus() == BedStatus.OCCUPIED)
            throw new DuplicateResourceException("Cannot delete an occupied bed");

        Ward ward = bed.getWard();
        ward.setTotalBeds(Math.max(0, ward.getTotalBeds() - 1));
        wardRepo.save(ward);
        bedRepo.delete(bed);
        auditLogService.log("Bed", bedId, "DELETE", currentUser(),
                "number=" + bed.getNumber() + " wardId=" + ward.getId());
    }

    public BedResponse updateBedStatus(Long bedId, BedStatus newStatus) {
        log.info("[BED] updateBedStatus id={} newStatus={}", bedId, newStatus);
        Bed bed = bedRepo.findById(bedId)
                .orElseThrow(() -> new ResourceNotFoundException("Bed", bedId));
        BedStatus old = bed.getStatus();
        bed.setStatus(newStatus);
        bedRepo.save(bed);

        // Update ward occupancy count
        Ward ward = bed.getWard();
        if (old == BedStatus.AVAILABLE && newStatus == BedStatus.OCCUPIED) {
            ward.setOccupiedBeds(ward.getOccupiedBeds() + 1);
        } else if (old == BedStatus.OCCUPIED && newStatus == BedStatus.AVAILABLE) {
            ward.setOccupiedBeds(Math.max(0, ward.getOccupiedBeds() - 1));
        }
        wardRepo.save(ward);
        auditLogService.log("Bed", bedId, "STATUS_UPDATE", currentUser(),
                "number=" + bed.getNumber() + " from=" + old + " to=" + newStatus);
        return toBedResponse(bed);
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return "system";
        }
        return auth.getPrincipal().toString();
    }

    private Ward findWardOrThrow(Long id) {
        return wardRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ward", id));
    }

    private String generateWardCode() {
        int seq = (wardRepo.findMaxSequence() == null ? 0 : wardRepo.findMaxSequence()) + 1;
        return String.format("W%03d", seq);
    }

    private WardResponse toWardResponse(Ward w) {
        WardResponse r = new WardResponse();
        r.setId(w.getId());
        r.setWardCode(w.getWardCode());
        r.setName(w.getName());
        r.setWardType(w.getWardType());
        r.setDepartmentId(w.getDepartment() != null ? w.getDepartment().getId() : null);
        r.setDepartmentName(w.getDepartment() != null ? w.getDepartment().getName() : null);
        r.setTotalBeds(w.getTotalBeds());
        r.setChargePerDay(w.getChargePerDay());
        r.setStatus(w.getStatus());
        r.setCreatedBy(w.getCreatedBy());
        r.setCreatedAt(w.getCreatedAt());
        r.setUpdatedAt(w.getUpdatedAt());

        List<Bed> beds = bedRepo.findByWard_Id(w.getId());

        // Compute occupancy live from actual bed statuses — never trust the stored counter
        int occupied  = (int) beds.stream().filter(b -> b.getStatus() == Bed.BedStatus.OCCUPIED).count();
        int available = (int) beds.stream().filter(b -> b.getStatus() == Bed.BedStatus.AVAILABLE).count();

        // Self-heal: keep the stored counter in sync so future queries stay consistent
        if (w.getOccupiedBeds() != occupied) {
            w.setOccupiedBeds(occupied);
            wardRepo.save(w);
        }

        r.setOccupiedBeds(occupied);
        r.setAvailableBeds(available);
        r.setBeds(beds.stream().map(this::toBedResponse).toList());
        return r;
    }

    private BedResponse toBedResponse(Bed b) {
        BedResponse r = new BedResponse();
        r.setId(b.getId());
        r.setNumber(b.getNumber());
        r.setWardId(b.getWard().getId());
        r.setWardName(b.getWard().getName());
        r.setStatus(b.getStatus());
        r.setPatientId(b.getPatientId());
        r.setPatientName(b.getPatientName());
        return r;
    }
}
