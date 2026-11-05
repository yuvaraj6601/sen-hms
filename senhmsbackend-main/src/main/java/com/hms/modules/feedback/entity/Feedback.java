package com.hms.modules.feedback.entity;

import com.hms.common.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

/**
 * A single NABH patient-satisfaction feedback submission.
 *
 * Captured from the public QR form on the patient's phone (name + mobile +
 * the 18 rating answers + free-text comments). Reviewed by staff from the
 * dashboard and exported for NABH submission.
 */
@Entity
@Table(name = "patient_feedback")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Feedback extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(nullable = false, length = 20)
    private String mobile;

    /** Optional free-text "Special Comments" from the form. */
    @Column(name = "comments", columnDefinition = "TEXT")
    private String comments;

    /**
     * Average numeric score (1–5) across all answered questions, computed at
     * submission time. Stored for fast list sorting / NABH summary reporting.
     */
    @Column(name = "average_score")
    private Double averageScore;

    @Builder.Default
    @OneToMany(mappedBy = "feedback", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<FeedbackAnswer> answers = new ArrayList<>();

    /** Attach an answer and keep both sides of the relationship in sync. */
    public void addAnswer(FeedbackAnswer answer) {
        answer.setFeedback(this);
        this.answers.add(answer);
    }
}
