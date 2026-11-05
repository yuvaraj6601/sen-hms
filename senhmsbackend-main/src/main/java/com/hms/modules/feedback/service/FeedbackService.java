package com.hms.modules.feedback.service;

import com.hms.common.AuditLogService;
import com.hms.exception.ResourceNotFoundException;
import com.hms.modules.feedback.dto.FeedbackAnswerRequest;
import com.hms.modules.feedback.dto.FeedbackRequest;
import com.hms.modules.feedback.dto.FeedbackResponse;
import com.hms.modules.feedback.dto.FeedbackSummaryResponse;
import com.hms.modules.feedback.entity.Feedback;
import com.hms.modules.feedback.entity.FeedbackAnswer;
import com.hms.modules.feedback.enums.FeedbackQuestion;
import com.hms.modules.feedback.repository.FeedbackRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class FeedbackService {

    private final FeedbackRepository repo;
    private final AuditLogService auditLogService;

    // ── Create (public, from QR form) ──────────────────────────────────────────

    public FeedbackResponse submit(FeedbackRequest req) {
        log.info("[FEEDBACK] Submitting feedback name='{}' mobile={}", req.getName(), req.getMobile());

        Feedback feedback = Feedback.builder()
                .name(req.getName().trim())
                .mobile(req.getMobile().trim())
                .comments(StringUtils.hasText(req.getComments()) ? req.getComments().trim() : null)
                .build();

        // Attach each submitted answer (rating may be null = skipped question).
        if (req.getAnswers() != null) {
            for (FeedbackAnswerRequest a : req.getAnswers()) {
                if (a == null || a.getQuestion() == null) continue;
                feedback.addAnswer(FeedbackAnswer.builder()
                        .question(a.getQuestion())
                        .rating(a.getRating())
                        .build());
            }
        }

        feedback.setAverageScore(computeAverage(feedback));

        Feedback saved = repo.save(feedback);
        log.info("[FEEDBACK] Saved id={} answers={} avg={}",
                saved.getId(), saved.getAnswers().size(), saved.getAverageScore());
        // Public submission — no authenticated principal; audit records "system".
        auditLogService.log("Feedback", saved.getId(), "SUBMIT", "system",
                "name=" + saved.getName() + " mobile=" + saved.getMobile());
        return toResponse(saved);
    }

    // ── Search / list ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Page<FeedbackSummaryResponse> search(String search, LocalDate dateFrom, LocalDate dateTo,
                                                Pageable pageable) {
        log.debug("[FEEDBACK] search query='{}' from={} to={}", search, dateFrom, dateTo);
        LocalDateTime from = dateFrom != null ? dateFrom.atStartOfDay() : null;
        LocalDateTime to   = dateTo   != null ? dateTo.atTime(LocalTime.MAX) : null;
        Page<Feedback> page = repo.search(
                StringUtils.hasText(search) ? search.trim() : null, from, to, pageable);
        return page.map(this::toSummary);
    }

    // ── Detail ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public FeedbackResponse getById(Long id) {
        log.debug("[FEEDBACK] getById id={}", id);
        return toResponse(findOrThrow(id));
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private Feedback findOrThrow(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Feedback", id));
    }

    /** Average of the non-null answer scores; null when nothing was rated. */
    private Double computeAverage(Feedback feedback) {
        List<Integer> scores = feedback.getAnswers().stream()
                .filter(a -> a.getRating() != null)
                .map(a -> a.getRating().getScore())
                .collect(Collectors.toList());
        if (scores.isEmpty()) return null;
        double avg = scores.stream().mapToInt(Integer::intValue).average().orElse(0);
        return Math.round(avg * 100.0) / 100.0;
    }

    private FeedbackSummaryResponse toSummary(Feedback f) {
        FeedbackSummaryResponse s = new FeedbackSummaryResponse();
        s.setId(f.getId());
        s.setName(f.getName());
        s.setMobile(f.getMobile());
        s.setAverageScore(f.getAverageScore());
        s.setAnsweredCount((int) f.getAnswers().stream().filter(a -> a.getRating() != null).count());
        s.setHasComments(StringUtils.hasText(f.getComments()));
        s.setCreatedAt(f.getCreatedAt());
        return s;
    }

    private FeedbackResponse toResponse(Feedback f) {
        FeedbackResponse r = new FeedbackResponse();
        r.setId(f.getId());
        r.setName(f.getName());
        r.setMobile(f.getMobile());
        r.setComments(f.getComments());
        r.setAverageScore(f.getAverageScore());
        r.setCreatedAt(f.getCreatedAt());

        List<FeedbackResponse.Answer> answers = f.getAnswers().stream()
                .sorted(Comparator.comparingInt(a -> a.getQuestion().getOrder()))
                .map(a -> {
                    FeedbackQuestion q = a.getQuestion();
                    FeedbackResponse.Answer dto = new FeedbackResponse.Answer();
                    dto.setQuestion(q.name());
                    dto.setOrder(q.getOrder());
                    dto.setQuestionEnglish(q.getEnglish());
                    dto.setQuestionTamil(q.getTamil());
                    dto.setRating(a.getRating() != null ? a.getRating().name() : null);
                    dto.setScore(a.getRating() != null ? a.getRating().getScore() : null);
                    return dto;
                })
                .collect(Collectors.toList());
        r.setAnswers(answers);
        return r;
    }
}
