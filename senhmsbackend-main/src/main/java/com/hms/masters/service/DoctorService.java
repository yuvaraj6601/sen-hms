package com.hms.masters.service;

import com.hms.exception.DuplicateResourceException;
import com.hms.exception.ResourceNotFoundException;
import com.hms.masters.dto.DoctorRequest;
import com.hms.masters.dto.DoctorResponse;
import com.hms.masters.entity.Department;
import com.hms.masters.entity.Doctor;
import com.hms.masters.enums.DoctorStatus;
import com.hms.masters.repository.DepartmentRepository;
import com.hms.masters.repository.DoctorRepository;
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

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class DoctorService {

    private final DoctorRepository doctorRepo;
    private final DepartmentRepository deptRepo;
    private final ContactService contactService;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public Page<DoctorResponse> search(String search, DoctorStatus status, Long deptId, Pageable pageable) {
        return doctorRepo.searchDoctors(
                StringUtils.hasText(search) ? search : null,
                status, deptId, pageable
        ).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public DoctorResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    public DoctorResponse create(DoctorRequest req) {
        log.info("[DOCTOR] create name='{}' dept={}", req.getName(), req.getDepartmentId());
        if (StringUtils.hasText(req.getRegistrationNo()) &&
                doctorRepo.existsByRegistrationNoIgnoreCase(req.getRegistrationNo()))
            throw new DuplicateResourceException("Registration number already exists: " + req.getRegistrationNo());

        Department dept = deptRepo.findById(req.getDepartmentId())
                .orElseThrow(() -> new ResourceNotFoundException("Department", req.getDepartmentId()));

        Doctor doctor = buildDoctor(new Doctor(), req, dept);
        DoctorResponse saved = toResponse(doctorRepo.save(doctor));
        log.info("[DOCTOR] Created id={} name='{}'", saved.getId(), saved.getName());
        auditLogService.log("Doctor", saved.getId(), "CREATE", currentUser(), "name=" + saved.getName() + " dept=" + saved.getDepartmentName());

        // Auto-create contact entry
        try {
            ContactRequest contact = new ContactRequest();
            contact.setName(req.getName());
            contact.setType(ContactType.DOCTOR);
            contact.setPhone(StringUtils.hasText(req.getPhone()) ? req.getPhone() : "0000000000");
            contact.setEmail(req.getEmail());
            contact.setOrganization(dept.getName());
            contactService.create(contact);
        } catch (Exception ignored) {
            // Contact creation is best-effort; don't fail the doctor save
        }

        return saved;
    }

    public DoctorResponse update(Long id, DoctorRequest req) {
        log.info("[DOCTOR] update id={}", id);
        Doctor doctor = findOrThrow(id);

        if (StringUtils.hasText(req.getRegistrationNo()) &&
                !req.getRegistrationNo().equalsIgnoreCase(doctor.getRegistrationNo()) &&
                doctorRepo.existsByRegistrationNoIgnoreCase(req.getRegistrationNo()))
            throw new DuplicateResourceException("Registration number already in use");

        Department dept = deptRepo.findById(req.getDepartmentId())
                .orElseThrow(() -> new ResourceNotFoundException("Department", req.getDepartmentId()));

        DoctorResponse dUpd = toResponse(doctorRepo.save(buildDoctor(doctor, req, dept)));
        auditLogService.log("Doctor", id, "UPDATE", currentUser(), "name=" + dUpd.getName());
        return dUpd;
    }

    public DoctorResponse toggleStatus(Long id) {
        log.info("[DOCTOR] toggleStatus id={}", id);
        Doctor doctor = findOrThrow(id);
        doctor.setStatus(doctor.getStatus() == DoctorStatus.ACTIVE
                ? DoctorStatus.INACTIVE : DoctorStatus.ACTIVE);
        DoctorResponse dToggled = toResponse(doctorRepo.save(doctor));
        auditLogService.log("Doctor", id, "TOGGLE_STATUS", currentUser(), "status=" + dToggled.getStatus());
        return dToggled;
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private Doctor buildDoctor(Doctor doctor, DoctorRequest req, Department dept) {
        doctor.setName(req.getName());
        doctor.setRegistrationNo(req.getRegistrationNo());
        doctor.setDob(req.getDob());
        doctor.setGender(req.getGender());
        doctor.setDepartment(dept);
        doctor.setPhone(req.getPhone());
        doctor.setEmail(req.getEmail());
        doctor.setExperienceYears(req.getExperienceYears());
        doctor.setOpdFee(req.getOpdFee());
        doctor.setOpdStartTime(req.getOpdStartTime());
        doctor.setOpdEndTime(req.getOpdEndTime());
        doctor.setAvgConsultMins(req.getAvgConsultMins());
        doctor.setBio(req.getBio());
        doctor.setStatus(req.getStatus() != null ? req.getStatus() : DoctorStatus.ACTIVE);
        doctor.setQualifications(listToCsv(req.getQualifications()));
        doctor.setSpecializations(listToCsv(req.getSpecializations()));
        doctor.setOpdDays(listToCsv(req.getOpdDays()));
        doctor.setIllnessTags(listToCsv(req.getIllnessTags()));
        return doctor;
    }

    private Doctor findOrThrow(Long id) {
        return doctorRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Doctor", id));
    }

    private String listToCsv(List<String> list) {
        if (list == null || list.isEmpty()) return null;
        return String.join(",", list);
    }

    private List<String> csvToList(String csv) {
        if (!StringUtils.hasText(csv)) return Collections.emptyList();
        return Arrays.stream(csv.split(",")).map(String::trim).toList();
    }

    DoctorResponse toResponse(Doctor d) {
        DoctorResponse r = new DoctorResponse();
        r.setId(d.getId());
        r.setName(d.getName());
        r.setRegistrationNo(d.getRegistrationNo());
        r.setDob(d.getDob());
        r.setGender(d.getGender());
        r.setDepartmentId(d.getDepartment() != null ? d.getDepartment().getId() : null);
        r.setDepartmentName(d.getDepartment() != null ? d.getDepartment().getName() : null);
        r.setPhone(d.getPhone());
        r.setEmail(d.getEmail());
        r.setExperienceYears(d.getExperienceYears());
        r.setOpdFee(d.getOpdFee());
        r.setOpdStartTime(d.getOpdStartTime());
        r.setOpdEndTime(d.getOpdEndTime());
        r.setAvgConsultMins(d.getAvgConsultMins());
        r.setBio(d.getBio());
        r.setStatus(d.getStatus());
        r.setQualifications(csvToList(d.getQualifications()));
        r.setSpecializations(csvToList(d.getSpecializations()));
        r.setOpdDays(csvToList(d.getOpdDays()));
        r.setIllnessTags(csvToList(d.getIllnessTags()));
        r.setCreatedBy(d.getCreatedBy());
        r.setCreatedAt(d.getCreatedAt());
        r.setUpdatedAt(d.getUpdatedAt());
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