package com.hms.modules.appointment.service;

import com.hms.exception.DuplicateResourceException;
import com.hms.exception.ResourceNotFoundException;
import com.hms.modules.appointment.dto.*;
import com.hms.modules.appointment.entity.Appointment;
import com.hms.modules.appointment.enums.AppointmentStatus;
import com.hms.modules.appointment.repository.AppointmentRepository;
import com.hms.modules.opvisit.dto.OPVisitRequest;
import com.hms.modules.opvisit.dto.OPVisitResponse;
import com.hms.modules.opvisit.enums.RegistrationSource;
import com.hms.modules.opvisit.service.OPVisitService;
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

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class AppointmentService {

    private final AppointmentRepository repo;
    private final AuditLogService auditLogService;
    private final OPVisitService opVisitService;

    // ── Book appointment ──────────────────────────────────────────────────────

    public AppointmentResponse book(AppointmentRequest req) {
        log.info("[APPOINTMENT] book patient='{}' doctor='{}' date={}", req.getPatientName(), req.getDoctorName(), req.getDate());

        // ── Slot conflict guard ───────────────────────────────────────────────
        if (req.getDoctorId() != null && req.getDate() != null
                && req.getTime() != null && !req.getTime().isBlank()) {
            boolean taken = repo.existsActiveSlot(req.getDoctorId(), req.getDate(), req.getTime());
            if (taken) {
                throw new DuplicateResourceException(
                    "Slot " + req.getTime() + " is already booked for this doctor on " + req.getDate()
                );
            }
        }

        String appointmentNo = generateAptNo(req.getDate());

        Appointment apt = Appointment.builder()
                .appointmentNo(appointmentNo)
                .patientId(req.getPatientId())
                .patientName(req.getPatientName())
                .uhid(req.getUhid())
                .phone(req.getPhone())
                .patientCategory(req.getPatientCategory())
                .doctorId(req.getDoctorId())
                .doctorName(req.getDoctorName())
                .department(req.getDepartment())
                .date(req.getDate())
                .time(req.getTime())
                .type(req.getType() != null ? req.getType()
                        : com.hms.modules.appointment.enums.AppointmentType.NEW)
                .status(AppointmentStatus.SCHEDULED)
                .reason(req.getReason())
                .bookedBy(req.getBookedBy())
                .bookedDate(LocalDate.now())
                .originalVisitDate(req.getOriginalVisitDate())
                .reviewNotes(req.getReviewNotes())
                .build();

        AppointmentResponse savedApt = toResponse(repo.save(apt));
        log.info("[APPOINTMENT] Saved aptNo={} status={}", savedApt.getAppointmentNo(), savedApt.getStatus());
        auditLogService.log("Appointment", savedApt.getId(), savedApt.getStatus().name(), currentUser(), "aptNo=" + savedApt.getAppointmentNo() + " patient=" + savedApt.getPatientName());
        return savedApt;
    }

    // ── Status transitions ────────────────────────────────────────────────────

    public AppointmentResponse updateStatus(Long id, AppointmentStatusRequest req) {
        Appointment apt = findOrThrow(id);

        switch (req.getStatus()) {
            case CONFIRMED -> {
                if (apt.getStatus() != AppointmentStatus.SCHEDULED) {
                    throw new DuplicateResourceException("Only SCHEDULED appointments can be confirmed");
                }
            }
            case IN_PROGRESS -> {
                if (apt.getStatus() != AppointmentStatus.CONFIRMED) {
                    throw new DuplicateResourceException("Only CONFIRMED appointments can be set In Progress");
                }
            }
            case COMPLETED -> {
                apt.setCompletionNotes(req.getCompletionNotes());
            }
            case CANCELLED -> {
                if (apt.getStatus() == AppointmentStatus.COMPLETED) {
                    throw new DuplicateResourceException("Cannot cancel a completed appointment");
                }
                if (!StringUtils.hasText(req.getCancelReason())) {
                    throw new DuplicateResourceException("Cancel reason is required");
                }
                apt.setCancelReason(req.getCancelReason());
            }
            case NO_SHOW -> {
                if (!List.of(AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED)
                        .contains(apt.getStatus())) {
                    throw new DuplicateResourceException("Cannot mark No Show for this status");
                }
            }
            default -> { }
        }

        apt.setStatus(req.getStatus());
        AppointmentResponse savedApt = toResponse(repo.save(apt));
        log.info("[APPOINTMENT] Saved aptNo={} status={}", savedApt.getAppointmentNo(), savedApt.getStatus());
        auditLogService.log("Appointment", savedApt.getId(), savedApt.getStatus().name(), currentUser(), "aptNo=" + savedApt.getAppointmentNo() + " patient=" + savedApt.getPatientName());
        return savedApt;
    }

    // ── Issue token (OP appointment → move patient into the OP queue) ─────────
    // Creates a real OP visit (which generates the token) carrying the booked
    // appointment time as the arrival time, links it back to the appointment,
    // and marks the appointment IN_PROGRESS. One transaction so the token and
    // the opVisitId link are always consistent.

    public AppointmentResponse issueOpToken(Long id) {
        Appointment apt = findOrThrow(id);

        if (!"OP".equalsIgnoreCase(apt.getPatientCategory())) {
            throw new DuplicateResourceException("Only OP appointments can be moved to the OP queue");
        }
        if (apt.getOpVisitId() != null) {
            throw new DuplicateResourceException(
                    "An OP token was already issued for this appointment (token "
                            + apt.getTokenNo() + ")");
        }
        if (apt.getStatus() == AppointmentStatus.CANCELLED
                || apt.getStatus() == AppointmentStatus.NO_SHOW
                || apt.getStatus() == AppointmentStatus.COMPLETED) {
            throw new DuplicateResourceException(
                    "Cannot issue a token for a " + apt.getStatus() + " appointment");
        }

        // Build the OP visit from the appointment. The patient already exists
        // (appointments always reference a real patientId), so this reuses the
        // patient rather than creating a walk-in.
        OPVisitRequest req = new OPVisitRequest();
        req.setPatientId(String.valueOf(apt.getPatientId()));
        req.setUhid(apt.getUhid());
        req.setPatientName(apt.getPatientName());
        req.setPhone(StringUtils.hasText(apt.getPhone()) ? apt.getPhone() : "0000000000");
        req.setDoctorId(String.valueOf(apt.getDoctorId()));
        req.setDoctorName(apt.getDoctorName());
        req.setDepartment(apt.getDepartment());
        // OP tokens are for the current day; carry the booked appointment time
        // as the arrival time so the slip and queue show when they were due.
        req.setVisitDate(LocalDate.now());
        req.setVisitTime(apt.getTime());
        req.setChiefComplaint(apt.getReason());
        req.setRegistrationSource(RegistrationSource.ML);

        OPVisitResponse visit = opVisitService.create(req);

        apt.setTokenNo(visit.getTokenNo());
        apt.setOpVisitId(visit.getId());
        apt.setStatus(AppointmentStatus.IN_PROGRESS);
        AppointmentResponse savedApt = toResponse(repo.save(apt));
        log.info("[APPOINTMENT] Issued OP token={} opVisitId={} for aptNo={}",
                visit.getTokenNo(), visit.getId(), savedApt.getAppointmentNo());
        auditLogService.log("Appointment", savedApt.getId(), "ISSUE_TOKEN", currentUser(),
                "aptNo=" + savedApt.getAppointmentNo() + " token=" + visit.getTokenNo()
                        + " opVisitId=" + visit.getId());
        return savedApt;
    }

    // ── Search / list ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<AppointmentResponse> search(String search, AppointmentStatus status,
                                            Long doctorId, String department,
                                            String patientCategory, LocalDate date,
                                            LocalDate dateFrom, LocalDate dateTo,
                                            Pageable pageable) {
        return repo.search(
                StringUtils.hasText(search)          ? search          : null,
                status,
                doctorId,
                StringUtils.hasText(department)      ? department      : null,
                StringUtils.hasText(patientCategory) ? patientCategory : null,
                date, dateFrom, dateTo, pageable
        ).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public AppointmentResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    @Transactional(readOnly = true)
    public List<AppointmentResponse> getByPatient(Long patientId) {
        return repo.findByPatientIdOrderByDateDescTimeDesc(patientId)
                .stream().map(this::toResponse).toList();
    }

    /**
     * Returns today's appointments for a specific doctor — used for the doctor's dashboard
     * and to enforce "doctor sees only their own" rule.
     */
    @Transactional(readOnly = true)
    public List<AppointmentResponse> getTodayByDoctor(Long doctorId) {
        return repo.findTodayByDoctor(doctorId, LocalDate.now())
                .stream().map(this::toResponse).toList();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String generateAptNo(LocalDate date) {
        String prefix = date.format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        int seq = repo.findMaxAptSeqForDate(prefix) + 1;
        return String.format("APT-%s-%04d", prefix, seq);
    }

    private Appointment findOrThrow(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", id));
    }

    private AppointmentResponse toResponse(Appointment a) {
        AppointmentResponse r = new AppointmentResponse();
        r.setId(a.getId());
        r.setAppointmentNo(a.getAppointmentNo());
        r.setPatientId(a.getPatientId());
        r.setPatientName(a.getPatientName());
        r.setUhid(a.getUhid());
        r.setPhone(a.getPhone());
        r.setPatientCategory(a.getPatientCategory());
        r.setDoctorId(a.getDoctorId());
        r.setDoctorName(a.getDoctorName());
        r.setDepartment(a.getDepartment());
        r.setDate(a.getDate());
        r.setTime(a.getTime());
        r.setType(a.getType());
        r.setStatus(a.getStatus());
        r.setReason(a.getReason());
        r.setBookedBy(a.getBookedBy());
        r.setBookedDate(a.getBookedDate());
        r.setCompletionNotes(a.getCompletionNotes());
        r.setCancelReason(a.getCancelReason());
        r.setOriginalVisitDate(a.getOriginalVisitDate());
        r.setReviewNotes(a.getReviewNotes());
        r.setTokenNo(a.getTokenNo());
        r.setOpVisitId(a.getOpVisitId());
        r.setSmsSent(a.isSmsSent());
        r.setCreatedBy(a.getCreatedBy());
        r.setCreatedAt(a.getCreatedAt());
        r.setUpdatedAt(a.getUpdatedAt());
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