package com.hms.modules.lab.service;

import com.hms.exception.DuplicateResourceException;
import com.hms.exception.ResourceNotFoundException;
import com.hms.modules.lab.dto.*;
import com.hms.modules.lab.entity.LabInvestigation;
import com.hms.modules.lab.enums.LabPriority;
import com.hms.modules.lab.enums.LabStatus;
import com.hms.modules.lab.repository.LabInvestigationRepository;
import com.hms.modules.admission.repository.AdmissionRepository;
import com.hms.modules.patient.repository.PatientRepository;
import com.hms.masters.entity.Investigation;
import com.hms.masters.repository.InvestigationRepository;
import com.hms.modules.billing.dto.BillItemRequest;
import com.hms.modules.billing.dto.BillRequest;
import com.hms.modules.billing.dto.BillResponse;
import com.hms.modules.billing.service.BillingService;
import com.hms.modules.billing.repository.BillRepository;
import com.hms.modules.billing.entity.Bill;
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
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.Period;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class LabService {

    private final LabInvestigationRepository repo;
    private final AdmissionRepository admissionRepo;
    private final PatientRepository patientRepo;
    private final InvestigationRepository investigationRepo;
    private final BillingService billingService;
    private final BillRepository billRepo;
    private final AuditLogService auditLogService;
    private final FileStorageService fileStorageService;
    // ── Order (batch — multiple tests at once) ────────────────────────────────

    public List<LabInvestigationResponse> order(LabOrderRequest req) {
        log.info("[LAB] order patientId={} tests={} orderedBy='{}'", req.getPatientId(), req.getTests().size(), req.getOrderedBy());
        // All tests placed in one order() call share a single group id so they
        // form one payable "order" in the grouped collection UI and estimation flow.
        final String groupId = java.util.UUID.randomUUID().toString();
        final Long resolvedAdmissionId =
                resolveAdmissionId(req.getAdmissionId(), req.getPatientId(), req.getPatientType());
        // All lab orders (IP and OP) start PENDING so the lab can generate an
        // estimation, which raises a bill (AWAITING_PAYMENT / "bill submitted").
        // IP patients may then have their sample collected while the bill is
        // still unpaid (settled at reception on release); OP must pay first.
        final LabStatus initialStatus = LabStatus.PENDING;
        return req.getTests().stream().map(line -> {
            String labId = generateLabId(req.getOrderedDate());

            LabInvestigation lab = LabInvestigation.builder()
                    .labId(labId)
                    .orderGroupId(groupId)
                    .patientId(req.getPatientId())
                    .patientName(req.getPatientName())
                    .uhid(req.getUhid())
                    .patientType(req.getPatientType())
                    .doctorName(req.getDoctorName())
                    .doctorId(req.getDoctorId())
                    .admissionId(resolvedAdmissionId)
                    .visitId(req.getVisitId())
                    .testCode(line.getTestCode())
                    .investigationName(line.getInvestigationName())
                    .category(line.getCategory())
                    .sampleType(line.getSampleType())
                    .normalRange(line.getNormalRange())
                    .unit(line.getUnit())
                    .turnaroundTime(line.getTurnaroundTime())
                    .price(line.getPrice())
                    .priority(line.getPriority() != null ? line.getPriority() : LabPriority.ROUTINE)
                    .orderedDate(req.getOrderedDate())
                    .orderedTime(req.getOrderedTime())
                    .orderedBy(req.getOrderedBy())
                    .status(initialStatus)
                    .build();

            LabInvestigation savedLab = repo.save(lab);
        log.info("[LAB] Saved labId={} group={} status={}", savedLab.getLabId(), groupId, savedLab.getStatus());
        auditLogService.log("Lab", savedLab.getId(), savedLab.getStatus().name(), currentUser(), "labId=" + savedLab.getLabId() + " patient=" + savedLab.getPatientName());
        return toResponse(savedLab);
        }).toList();
    }

    // ── Collect sample: PAID → IN_PROGRESS ───────────────────────────────────

    public LabInvestigationResponse collectSample(Long id, LabCollectRequest req) {
        log.info("[LAB] collectSample id={} by='{}'", id, req.getCollectedBy());
        LabInvestigation lab = findOrThrow(id);
        // OP must pay first (PAID). IP patients settle at reception on release,
        // so the lab may collect/process once the estimation bill is raised
        // (AWAITING_PAYMENT) — or after payment (PAID).
        final boolean isInpatient = "IP".equalsIgnoreCase(lab.getPatientType());
        final boolean collectible = lab.getStatus() == LabStatus.PAID
                || (isInpatient && lab.getStatus() == LabStatus.AWAITING_PAYMENT);
        if (!collectible) {
            String reason = isInpatient
                    ? "Cannot collect sample — generate the estimation first (test is " + lab.getStatus() + ")"
                    : "Cannot collect sample — payment not completed (test is " + lab.getStatus() + ")";
            throw new DuplicateResourceException(reason);
        }
        LocalDate now = LocalDate.now();
        lab.setStatus(LabStatus.IN_PROGRESS);
        lab.setCollectedDate(now);
        lab.setCollectedTime(java.time.LocalTime.now().format(
                DateTimeFormatter.ofPattern("HH:mm")));
        lab.setCollectedBy(req.getCollectedBy());
        LabInvestigation savedLab = repo.save(lab);
        log.info("[LAB] Saved labId={} status={}", savedLab.getLabId(), savedLab.getStatus());
        auditLogService.log("Lab", savedLab.getId(), savedLab.getStatus().name(), currentUser(), "labId=" + savedLab.getLabId() + " patient=" + savedLab.getPatientName());
        return toResponse(savedLab);
    }

    // ── Enter result: IN_PROGRESS → COMPLETED ────────────────────────────────

    public LabInvestigationResponse enterResult(Long id, LabResultRequest req) {
        log.info("[LAB] enterResult id={} by='{}'", id, req.getCompletedBy());
        LabInvestigation lab = findOrThrow(id);
        if (lab.getStatus() != LabStatus.IN_PROGRESS) {
            throw new DuplicateResourceException(
                    "Cannot enter result — test is " + lab.getStatus());
        }

        boolean hasSingle = StringUtils.hasText(req.getResult());
        boolean hasParams = StringUtils.hasText(req.getParameterResults())
                && !"[]".equals(req.getParameterResults().trim());
        if (!hasSingle && !hasParams) {
            throw new IllegalArgumentException(
                    "A result value or at least one parameter result is required");
        }

        LocalDate now = LocalDate.now();
        String nowTime = java.time.LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm"));

        // Calculate actual TAT in minutes
        int tatMinutes = 0;
        if (lab.getOrderedDate() != null && lab.getOrderedTime() != null) {
            try {
                java.time.LocalDateTime ordered = java.time.LocalDateTime.of(
                        lab.getOrderedDate(),
                        java.time.LocalTime.parse(lab.getOrderedTime()));
                tatMinutes = (int) java.time.temporal.ChronoUnit.MINUTES
                        .between(ordered, java.time.LocalDateTime.now());
            } catch (Exception ignored) { }
        }

        // Auto-detect abnormal. For multi-parameter tests the abnormal flag is
        // the OR of each parameter's own abnormal flag (set by the frontend from
        // the master's min/max). For simple tests, derive from result vs range.
        boolean abnormal = hasParams
                ? anyParameterAbnormal(req.getParameterResults())
                : detectAbnormal(req.getResult(), lab.getNormalRange());

        lab.setResult(hasSingle ? req.getResult() : null);
        lab.setParameterResults(hasParams ? req.getParameterResults() : null);
        lab.setAbnormal(abnormal);
        lab.setCompletedDate(now);
        lab.setCompletedTime(nowTime);
        lab.setCompletedBy(req.getCompletedBy());
        lab.setActualTatMinutes(tatMinutes);
        lab.setStatus(LabStatus.COMPLETED);

        LabInvestigation savedLab = repo.save(lab);
        log.info("[LAB] Saved labId={} status={}", savedLab.getLabId(), savedLab.getStatus());
        auditLogService.log("Lab", savedLab.getId(), savedLab.getStatus().name(), currentUser(), "labId=" + savedLab.getLabId() + " patient=" + savedLab.getPatientName());
        return toResponse(savedLab);
    }

    // ── Cancel ────────────────────────────────────────────────────────────────

    public LabInvestigationResponse cancel(Long id, LabCancelRequest req) {
        log.info("[LAB] cancel id={} reason='{}'", id, req.getReason());
        LabInvestigation lab = findOrThrow(id);
        if (lab.getStatus() == LabStatus.COMPLETED) {
            throw new DuplicateResourceException("Cannot cancel a completed test");
        }
        lab.setStatus(LabStatus.CANCELLED);
        lab.setCancelReason(req.getReason());
        LabInvestigation savedLab = repo.save(lab);
        log.info("[LAB] Saved labId={} status={}", savedLab.getLabId(), savedLab.getStatus());
        auditLogService.log("Lab", savedLab.getId(), savedLab.getStatus().name(), currentUser(), "labId=" + savedLab.getLabId() + " patient=" + savedLab.getPatientName());
        return toResponse(savedLab);
    }

    // ── Search / list ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<LabInvestigationResponse> search(String search, LabStatus status,
                                                 LabPriority priority, String category,
                                                 Long doctorId,
                                                 LocalDate dateFrom, LocalDate dateTo,
                                                 Pageable pageable) {
        return repo.search(
                StringUtils.hasText(search)   ? search   : null,
                status, priority,
                StringUtils.hasText(category) ? category : null,
                doctorId, dateFrom, dateTo, pageable
        ).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public LabInvestigationResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    @Transactional(readOnly = true)
    public List<LabInvestigationResponse> getByPatient(Long patientId) {
        return repo.findByPatientIdOrderByOrderedDateDescOrderedTimeDesc(patientId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<LabInvestigationResponse> getByAdmission(Long admissionId) {
        return repo.findByAdmissionIdOrderByOrderedDateDescOrderedTimeDesc(admissionId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<LabInvestigationResponse> getByVisit(Long visitId) {
        return repo.findByVisitIdOrderByOrderedDateDescOrderedTimeDesc(visitId)
                .stream().map(this::toResponse).toList();
    }

    // ── Grouped collection view (pharmacy-style rows) ─────────────────────────

    @Transactional(readOnly = true)
    public List<LabOrderGroupResponse> getOrderGroups(LocalDate dateFrom, LocalDate dateTo) {
        List<LabInvestigation> all = repo.findForCollection(dateFrom, dateTo);

        // Preserve the recency order of findForCollection by using a LinkedHashMap
        // keyed on the group id (fallback to lab id for any legacy null group).
        java.util.Map<String, List<LabInvestigation>> grouped = new java.util.LinkedHashMap<>();
        for (LabInvestigation l : all) {
            String key = l.getOrderGroupId() != null ? l.getOrderGroupId() : ("lab-" + l.getId());
            grouped.computeIfAbsent(key, k -> new java.util.ArrayList<>()).add(l);
        }

        return grouped.entrySet().stream()
                .map(e -> toGroupResponse(e.getKey(), e.getValue()))
                .toList();
    }

    /**
     * UNBILLED lab order groups for an admission — the IP labs that have NOT been
     * folded into a bill yet (billedInBillId == null, excluding cancelled tests).
     *
     * These are the lab orders that the bill list shows as virtual sub-rows under
     * the admission (there is no separate lab Bill for IP). Each group carries its
     * orderGroupId (the row key, since there is no billId), the test line items and
     * the estimated total; the row's Pay action records a "Lab" receipt against the
     * admission's main IP bill, and Auto-fill on the IP bill pulls these in as line
     * items. Once the IP bill is saved the tests get billedInBillId stamped and
     * drop out of this list.
     */
    @Transactional(readOnly = true)
    public List<LabOrderGroupResponse> getUnbilledOrderGroupsForAdmission(Long admissionId) {
        List<LabInvestigation> labs = repo
                .findByAdmissionIdOrderByOrderedDateDescOrderedTimeDesc(admissionId)
                .stream()
                .filter(l -> l.getBilledInBillId() == null)
                .filter(l -> l.getStatus() != LabStatus.CANCELLED)
                .toList();

        java.util.Map<String, List<LabInvestigation>> grouped = new java.util.LinkedHashMap<>();
        for (LabInvestigation l : labs) {
            String key = l.getOrderGroupId() != null ? l.getOrderGroupId() : ("lab-" + l.getId());
            grouped.computeIfAbsent(key, k -> new java.util.ArrayList<>()).add(l);
        }

        return grouped.entrySet().stream()
                .map(e -> toGroupResponse(e.getKey(), e.getValue()))
                .toList();
    }

    @Transactional(readOnly = true)
    public LabOrderGroupResponse getOrderGroup(String orderGroupId) {
        List<LabInvestigation> tests = repo.findByOrderGroupIdOrderByIdAsc(orderGroupId);
        if (tests.isEmpty()) {
            throw new ResourceNotFoundException("Lab order group", 0L);
        }
        return toGroupResponse(orderGroupId, tests);
    }

    // ── Generate estimation → create bill, flip group to AWAITING_PAYMENT ──────

    /**
     * Generates an estimation for an order group:
     *   1. Re-pulls the current price from the Lab Master for each test
     *      (falls back to the price snapshotted at order time if the master
     *      row is missing).
     *   2. Creates ONE bill for the admission/visit with one line item per test.
     *   3. Stamps each test with billedInBillId and flips it to AWAITING_PAYMENT.
     *
     * Idempotent-ish: throws if the group has already been estimated/billed.
     */
    public LabOrderGroupResponse generateEstimation(String orderGroupId, String generatedBy) {
        log.info("[LAB] generateEstimation group={} by='{}'", orderGroupId, generatedBy);
        List<LabInvestigation> tests = repo.findByOrderGroupIdOrderByIdAsc(orderGroupId);
        if (tests.isEmpty()) {
            throw new ResourceNotFoundException("Lab order group", 0L);
        }

        // Only PENDING tests are eligible. If any test is already billed, block.
        boolean alreadyBilled = tests.stream().anyMatch(t -> t.getBilledInBillId() != null);
        if (alreadyBilled) {
            throw new DuplicateResourceException(
                    "Estimation already generated for this order group");
        }
        List<LabInvestigation> eligible = tests.stream()
                .filter(t -> t.getStatus() == LabStatus.PENDING)
                .toList();
        if (eligible.isEmpty()) {
            throw new DuplicateResourceException(
                    "No tests pending estimation in this order group");
        }

        LabInvestigation first = eligible.get(0);
        boolean inpatient = "IP".equalsIgnoreCase(first.getPatientType())
                || "BOTH".equalsIgnoreCase(first.getPatientType());

        // ── IP / BOTH: NO separate lab bill ───────────────────────────────────
        // Inpatient lab charges are NOT billed on their own. They stay UNBILLED
        // (billedInBillId == null) so the craft/discharge IP bill's Auto-fill
        // pulls them in as line items, and the money is collected as a "Lab"
        // receipt against the admission's single IP bill. The tests are moved
        // straight to PAID so the lab can collect the sample and process
        // immediately — there is no pending lab bill and no "awaiting payment"
        // step for inpatients.
        if (inpatient) {
            for (LabInvestigation t : eligible) {
                t.setStatus(LabStatus.PAID);
                repo.save(t);
                auditLogService.log("Lab", t.getId(), "PAID", currentUser(),
                        "labId=" + t.getLabId() + " (IP — no separate bill, folds into IP bill)");
            }
            log.info("[LAB] estimation group={} IP — no bill, {} test(s) released to processing",
                    orderGroupId, eligible.size());
            return toGroupResponse(orderGroupId, repo.findByOrderGroupIdOrderByIdAsc(orderGroupId));
        }

        // ── OP: raise the lab bill as before (paid at reception) ──────────────
        // Build bill line items, re-pricing from the current lab master.
        List<BillItemRequest> items = eligible.stream().map(t -> {
            BigDecimalHolder priced = currentPrice(t);
            BillItemRequest line = new BillItemRequest();
            line.setServiceCode(t.getTestCode());
            line.setModalityName("Laboratory");
            line.setDescription(t.getInvestigationName() + " (" + t.getLabId() + ")");
            line.setQuantity(1);
            line.setUnitPrice(priced.value);
            line.setDiscount(java.math.BigDecimal.ZERO);
            line.setLabId(t.getId());   // BillingService stamps billedInBillId from this
            return line;
        }).toList();

        BillRequest bill = new BillRequest();
        bill.setPatientId(first.getPatientId());
        bill.setUhid(first.getUhid());
        bill.setPatientName(first.getPatientName());
        bill.setPatientType("OP");
        bill.setDoctorName(first.getDoctorName());
        bill.setTowards("Lab");
        bill.setAdmissionId(first.getAdmissionId());
        bill.setVisitId(first.getVisitId());
        bill.setDate(LocalDate.now());
        bill.setItems(items);
        bill.setDraft(false);                 // real pending bill, not a draft
        bill.setAmountPaid(java.math.BigDecimal.ZERO);  // unpaid — reception collects later
        bill.setCreatedBy(generatedBy);

        // BillingService.create() persists the bill AND stamps each lab test's
        // billedInBillId (it already handles line.getLabId()).
        BillResponse created = billingService.create(bill);

        // Flip the billed tests to AWAITING_PAYMENT.
        for (LabInvestigation t : eligible) {
            t.setStatus(LabStatus.AWAITING_PAYMENT);
            repo.save(t);
            auditLogService.log("Lab", t.getId(), "AWAITING_PAYMENT", currentUser(),
                    "labId=" + t.getLabId() + " billNo=" + created.getBillNo());
        }

        log.info("[LAB] estimation group={} billNo={} total={}",
                orderGroupId, created.getBillNo(), created.getTotalAmount());

        return toGroupResponse(orderGroupId, repo.findByOrderGroupIdOrderByIdAsc(orderGroupId));
    }

    /** Current lab-master price for a test, falling back to the ordered snapshot. */
    private BigDecimalHolder currentPrice(LabInvestigation t) {
        java.math.BigDecimal fallback = t.getPrice() != null
                ? java.math.BigDecimal.valueOf(t.getPrice())
                : java.math.BigDecimal.ZERO;
        java.math.BigDecimal price = investigationRepo.findByTestCode(t.getTestCode())
                .map(Investigation::getPrice)
                .orElse(fallback);
        if (price == null) price = fallback;
        return new BigDecimalHolder(price);
    }

    /** Tiny holder so the lambda stays readable. */
    private record BigDecimalHolder(java.math.BigDecimal value) {}

    private LabOrderGroupResponse toGroupResponse(String groupId, List<LabInvestigation> tests) {
        LabOrderGroupResponse g = new LabOrderGroupResponse();
        LabInvestigation first = tests.getFirst();

        g.setOrderGroupId(groupId);
        g.setPatientId(first.getPatientId());
        g.setPatientName(first.getPatientName());
        g.setUhid(first.getUhid());
        g.setPatientType(first.getPatientType());
        g.setDoctorName(first.getDoctorName());
        g.setAdmissionId(first.getAdmissionId());
        g.setVisitId(first.getVisitId());

        // Age / gender / phone are not stored on the lab row — pull from the
        // patient record (fast single lookup, cached per group).
        if (first.getPatientId() != null) {
            patientRepo.findById(first.getPatientId()).ifPresent(p -> {
                g.setAge(p.getAge());
                g.setGender(p.getGender() != null ? p.getGender().name() : null);
                g.setPhone(p.getPhone());
            });
        }
        // Admission number for the slip (when linked to an admission).
        if (first.getAdmissionId() != null) {
            admissionRepo.findById(first.getAdmissionId())
                    .ifPresent(a -> g.setAdmissionNo(a.getAdmissionNo()));
        }
        g.setOrderedDate(first.getOrderedDate());
        g.setOrderedTime(first.getOrderedTime());
        g.setOrderedBy(first.getOrderedBy());
        g.setTestCount(tests.size());

        double est = tests.stream()
                .mapToDouble(t -> t.getPrice() != null ? t.getPrice() : 0d)
                .sum();
        g.setEstimatedTotal(est);

        // Resolve the linked bill (any test's billedInBillId — they share one).
        Long billId = tests.stream()
                .map(LabInvestigation::getBilledInBillId)
                .filter(java.util.Objects::nonNull)
                .findFirst().orElse(null);
        if (billId != null) {
            g.setBillId(billId);
            billRepo.findById(billId).ifPresent(b -> {
                g.setBillNo(b.getBillNo());
                g.setPaidAmount(b.getPaidAmount() != null ? b.getPaidAmount().doubleValue() : 0d);
                g.setDueAmount(b.getDueAmount() != null ? b.getDueAmount().doubleValue() : 0d);
            });
        }

        g.setGroupStatus(rollupStatus(tests));
        g.setTests(tests.stream().map(this::toResponse).toList());
        return g;
    }

    /** Collapse the per-test statuses into one group-level status for the UI. */
    private String rollupStatus(List<LabInvestigation> tests) {
        java.util.Set<LabStatus> active = tests.stream()
                .map(LabInvestigation::getStatus)
                .filter(s -> s != LabStatus.CANCELLED)
                .collect(java.util.stream.Collectors.toSet());
        if (active.isEmpty()) return LabStatus.CANCELLED.name();
        if (active.size() == 1) return active.iterator().next().name();
        // Mixed — pick the earliest stage still outstanding so the UI shows the
        // next action needed.
        if (active.contains(LabStatus.PENDING))          return LabStatus.PENDING.name();
        if (active.contains(LabStatus.AWAITING_PAYMENT))  return LabStatus.AWAITING_PAYMENT.name();
        if (active.contains(LabStatus.PAID))              return LabStatus.PAID.name();
        if (active.contains(LabStatus.IN_PROGRESS))       return LabStatus.IN_PROGRESS.name();
        return LabStatus.COMPLETED.name();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private String generateLabId(LocalDate date) {
        String prefix = date.format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        int seq = repo.findMaxLabSeqForDate(prefix) + 1;
        return String.format("LAB-%s-%05d", prefix, seq);
    }

    private LabInvestigation findOrThrow(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Lab investigation", id));
    }

    /**
     * Detect abnormal result by comparing numeric value against
     * normal range strings like "70–110 mg/dL" or "< 0.04 ng/mL".
     */
    private boolean detectAbnormal(String result, String normalRange) {
        if (result == null || normalRange == null) return false;
        try {
            double val = Double.parseDouble(result.replaceAll("[^0-9.]", "").trim());

            // Range: "70–110" or "70-110"
            java.util.regex.Matcher rangeMatcher = java.util.regex.Pattern
                    .compile("([\\d.]+)\\s*[–\\-]\\s*([\\d.]+)")
                    .matcher(normalRange);
            if (rangeMatcher.find()) {
                double lo = Double.parseDouble(rangeMatcher.group(1));
                double hi = Double.parseDouble(rangeMatcher.group(2));
                return val < lo || val > hi;
            }

            // Less-than: "< 0.04"
            java.util.regex.Matcher ltMatcher = java.util.regex.Pattern
                    .compile("<\\s*([\\d.]+)")
                    .matcher(normalRange);
            if (ltMatcher.find()) {
                return val >= Double.parseDouble(ltMatcher.group(1));
            }
        } catch (Exception ignored) { }
        return false;
    }

    /**
     * Whether any parameter in the structured results JSON is flagged abnormal.
     * The frontend computes each parameter's abnormal flag against the master's
     * min/max, so a simple scan for an abnormal:true token is sufficient and
     * avoids a JSON-parse dependency here.
     */
    private boolean anyParameterAbnormal(String parameterResultsJson) {
        if (!StringUtils.hasText(parameterResultsJson)) return false;
        return java.util.regex.Pattern
                .compile("\"abnormal\"\\s*:\\s*true")
                .matcher(parameterResultsJson)
                .find();
    }

    
    /**
     * Auto-resolve admissionId for IP patients when the caller doesn't supply one.
     * Looks up the currently active admission for the patient.
     */
    private Long resolveAdmissionId(Long provided, Long patientId, String patientType) {
        if (provided != null) return provided;
        if (!"IP".equalsIgnoreCase(patientType) && !"BOTH".equalsIgnoreCase(patientType)) return null;
        return admissionRepo.findActiveByPatientId(patientId)
                .map(a -> a.getId())
                .orElse(null);
    }
private LabInvestigationResponse toResponse(LabInvestigation l) {
        LabInvestigationResponse r = new LabInvestigationResponse();
        r.setId(l.getId());
        r.setLabId(l.getLabId());
        r.setOrderGroupId(l.getOrderGroupId());
        r.setPatientId(l.getPatientId());
        r.setPatientName(l.getPatientName());
        r.setUhid(l.getUhid());
        r.setPatientType(l.getPatientType());
        r.setDoctorName(l.getDoctorName());
        r.setDoctorId(l.getDoctorId());
        r.setAdmissionId(l.getAdmissionId());
        r.setVisitId(l.getVisitId());

        // ── Enrich with patient age/gender + IP number for report printing ──
        // These are not denormalised on the lab row, so look them up. Best-effort:
        // a missing patient/admission must never break the lab response.
        try {
            patientRepo.findById(l.getPatientId()).ifPresent(p -> {
                r.setAge(resolveAge(p.getDateOfBirth(), p.getAge()));
                r.setGender(p.getGender() != null ? p.getGender().name() : null);
            });
        } catch (Exception ignored) { /* leave age/gender null */ }
        if (l.getAdmissionId() != null) {
            try {
                admissionRepo.findById(l.getAdmissionId())
                        .ifPresent(a -> r.setAdmissionNo(a.getAdmissionNo()));
            } catch (Exception ignored) { /* leave admissionNo null */ }
        }
        r.setTestCode(l.getTestCode());
        r.setInvestigationName(l.getInvestigationName());
        r.setCategory(l.getCategory());
        r.setSampleType(l.getSampleType());
        r.setNormalRange(l.getNormalRange());
        r.setUnit(l.getUnit());
        r.setTurnaroundTime(l.getTurnaroundTime());
        r.setPrice(l.getPrice());
        r.setPriority(l.getPriority());
        r.setOrderedDate(l.getOrderedDate());
        r.setOrderedTime(l.getOrderedTime());
        r.setOrderedBy(l.getOrderedBy());
        r.setCollectedDate(l.getCollectedDate());
        r.setCollectedTime(l.getCollectedTime());
        r.setCollectedBy(l.getCollectedBy());
        r.setResult(l.getResult());
        r.setParameterResults(l.getParameterResults());
        // Enrich the master parameter template so the result-entry UI can render
        // a structured form. Best-effort: a missing master must never break the
        // lab response.
        try {
            investigationRepo.findByTestCode(l.getTestCode())
                    .map(Investigation::getParameters)
                    .ifPresent(r::setParametersTemplate);
        } catch (Exception ignored) { /* leave parametersTemplate null */ }
        r.setAbnormal(l.isAbnormal());
        r.setCompletedDate(l.getCompletedDate());
        r.setCompletedTime(l.getCompletedTime());
        r.setCompletedBy(l.getCompletedBy());
        r.setActualTatMinutes(l.getActualTatMinutes());
        r.setCancelReason(l.getCancelReason());
        r.setBilledInBillId(l.getBilledInBillId());
        r.setStatus(l.getStatus());
        // PDF / image attachments
        r.setReportPdfPath(l.getReportPdfPath());
        r.setReportImages(l.getReportImages());
        // resultType from the investigation master (best-effort)
        try {
            investigationRepo.findByTestCode(l.getTestCode())
                    .map(Investigation::getResultType)
                    .ifPresent(r::setResultType);
        } catch (Exception ignored) { /* leave resultType null */ }
        r.setCreatedBy(l.getCreatedBy());
        r.setCreatedAt(l.getCreatedAt());
        r.setUpdatedAt(l.getUpdatedAt());
        return r;
    }

    /** Age from DOB when available (accurate), otherwise the stored age value. */
    private Integer resolveAge(LocalDate dob, Integer storedAge) {
        if (dob != null) {
            return Period.between(dob, LocalDate.now()).getYears();
        }
        return storedAge;
    }

    // ── Attach PDF / image to a lab investigation ─────────────────────────────

    /**
     * Stores an uploaded file (PDF report or image) against a lab investigation.
     *
     * <p>Rules:
     * <ul>
     *   <li>Test must be IN_PROGRESS.
     *   <li>type="pdf"   → stores file, sets {@code reportPdfPath}, marks COMPLETED.
     *   <li>type="image" → appends path to {@code reportImages} JSON array; does NOT
     *       auto-complete (images are supplementary to the PDF).
     * </ul>
     */
    public LabInvestigationResponse attachFile(Long id, MultipartFile file,
                                               String fileType, String completedBy) {
        log.info("[LAB-ATTACH] id={} type={} size={}", id, fileType, file.getSize());
        LabInvestigation lab = findOrThrow(id);

        if (lab.getStatus() != LabStatus.IN_PROGRESS) {
            throw new com.hms.exception.DuplicateResourceException(
                    "Cannot attach file — test is " + lab.getStatus()
                    + " (must be IN_PROGRESS)");
        }

        String relativePath = fileStorageService.store(file, lab.getLabId(), fileType);

        if ("pdf".equals(fileType)) {
            // Replace existing PDF if any
            if (StringUtils.hasText(lab.getReportPdfPath())) {
                fileStorageService.delete(lab.getReportPdfPath());
            }
            lab.setReportPdfPath(relativePath);

            // Auto-complete the test on PDF upload
            LocalDate now  = LocalDate.now();
            String nowTime = java.time.LocalTime.now()
                    .format(DateTimeFormatter.ofPattern("HH:mm"));
            int tatMinutes = 0;
            if (lab.getOrderedDate() != null && lab.getOrderedTime() != null) {
                try {
                    java.time.LocalDateTime ordered = java.time.LocalDateTime.of(
                            lab.getOrderedDate(),
                            java.time.LocalTime.parse(lab.getOrderedTime()));
                    tatMinutes = (int) java.time.temporal.ChronoUnit.MINUTES
                            .between(ordered, java.time.LocalDateTime.now());
                } catch (Exception ignored) { }
            }
            lab.setResult("PDF");   // sentinel — result column must be non-null for COMPLETED
            lab.setCompletedDate(now);
            lab.setCompletedTime(nowTime);
            lab.setCompletedBy(StringUtils.hasText(completedBy) ? completedBy : currentUser());
            lab.setActualTatMinutes(tatMinutes);
            lab.setStatus(LabStatus.COMPLETED);

        } else if ("image".equals(fileType)) {
            // Append to the images JSON array
            List<String> images = new ArrayList<>();
            if (StringUtils.hasText(lab.getReportImages())) {
                try {
                    com.fasterxml.jackson.databind.ObjectMapper om =
                            new com.fasterxml.jackson.databind.ObjectMapper();
                    String[] arr = om.readValue(lab.getReportImages(), String[].class);
                    images.addAll(java.util.Arrays.asList(arr));
                } catch (Exception ignored) { }
            }
            images.add(relativePath);
            try {
                com.fasterxml.jackson.databind.ObjectMapper om =
                        new com.fasterxml.jackson.databind.ObjectMapper();
                lab.setReportImages(om.writeValueAsString(images));
            } catch (Exception e) {
                throw new RuntimeException("Failed to serialize image list", e);
            }
        } else {
            throw new IllegalArgumentException(
                    "Unknown file type '" + fileType + "' — expected 'pdf' or 'image'");
        }

        LabInvestigation saved = repo.save(lab);
        log.info("[LAB-ATTACH] labId={} status={}", saved.getLabId(), saved.getStatus());
        auditLogService.log("Lab", saved.getId(), "FILE_ATTACHED",
                currentUser(), "labId=" + saved.getLabId() + " type=" + fileType);
        return toResponse(saved);
    }

    private String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return "system";
        }
        return auth.getPrincipal().toString();
    }
}