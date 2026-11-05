package com.hms.modules.feedback.entity;

import com.hms.modules.feedback.enums.FeedbackQuestion;
import com.hms.modules.feedback.enums.FeedbackRating;
import jakarta.persistence.*;
import lombok.*;

/**
 * One answer to one NABH question within a {@link Feedback} submission.
 * A rating may be null when the patient leaves a question blank
 * ("Please do not answer if anything is not applicable").
 */
@Entity
@Table(name = "patient_feedback_answer")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FeedbackAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "feedback_id", nullable = false)
    private Feedback feedback;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private FeedbackQuestion question;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private FeedbackRating rating;
}
