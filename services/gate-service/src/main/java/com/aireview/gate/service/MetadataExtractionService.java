package com.aireview.gate.service;

import com.aireview.gate.model.ReviewResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Service for extracting and aggregating metadata from code reviews.
 * Provides analytics on review trends, issue patterns, and team metrics.
 */
@Service
public class MetadataExtractionService {

    private static final Logger log = LoggerFactory.getLogger(MetadataExtractionService.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    // In-memory store for aggregated metrics (swap for DB in production)
    private final Map<String, RepoMetrics> repoMetricsStore = new HashMap<>();

    /**
     * Extract and store metadata from a completed review.
     */
    public Map<String, Object> extractMetadata(ReviewResult review) {
        Map<String, Object> metadata = new LinkedHashMap<>();

        metadata.put("reviewId", review.getReviewId());
        metadata.put("repo", review.getRepo());
        metadata.put("branch", review.getBranch());
        metadata.put("timestamp", review.getCompletedAt());

        if (review.getResult() != null) {
            ReviewResult.ReviewData data = review.getResult();

            // Issue breakdown
            Map<String, Long> severityCounts = Optional.ofNullable(data.getIssues())
                    .orElse(Collections.emptyList())
                    .stream()
                    .collect(Collectors.groupingBy(
                            i -> i.getSeverity().toUpperCase(),
                            Collectors.counting()
                    ));

            Map<String, Long> categoryCounts = Optional.ofNullable(data.getIssues())
                    .orElse(Collections.emptyList())
                    .stream()
                    .collect(Collectors.groupingBy(
                            ReviewResult.ReviewIssue::getCategory,
                            Collectors.counting()
                    ));

            metadata.put("score", data.getScore());
            metadata.put("total_issues", Optional.ofNullable(data.getIssues()).map(List::size).orElse(0));
            metadata.put("severity_breakdown", severityCounts);
            metadata.put("category_breakdown", categoryCounts);

            if (data.getMetadata() != null) {
                metadata.put("files_reviewed", data.getMetadata().getFilesReviewed());
                metadata.put("lines_added", data.getMetadata().getTotalAdditions());
                metadata.put("lines_deleted", data.getMetadata().getTotalDeletions());
                metadata.put("languages", data.getMetadata().getLanguagesDetected());
            }

            // Top issues (high confidence + high severity)
            List<String> topIssues = Optional.ofNullable(data.getIssues())
                    .orElse(Collections.emptyList())
                    .stream()
                    .filter(i -> i.getConfidence() >= 0.7)
                    .sorted((a, b) -> {
                        int sevCompare = severityRank(b.getSeverity()) - severityRank(a.getSeverity());
                        return sevCompare != 0 ? sevCompare : Double.compare(b.getConfidence(), a.getConfidence());
                    })
                    .limit(5)
                    .map(i -> String.format("[%s] %s (%s:%d)", i.getSeverity(), i.getTitle(), i.getFile(), i.getLineStart()))
                    .collect(Collectors.toList());

            metadata.put("top_issues", topIssues);

            // Update aggregated repo metrics
            updateRepoMetrics(review.getRepo(), data);
        }

        log.info("📊 Metadata extracted for review {} — {} fields", review.getReviewId(), metadata.size());
        return metadata;
    }

    /**
     * Get aggregated metrics for a repository.
     */
    public RepoMetrics getRepoMetrics(String repo) {
        return repoMetricsStore.getOrDefault(repo, new RepoMetrics());
    }

    /**
     * Get all repo metrics.
     */
    public Map<String, RepoMetrics> getAllRepoMetrics() {
        return Collections.unmodifiableMap(repoMetricsStore);
    }

    private void updateRepoMetrics(String repo, ReviewResult.ReviewData data) {
        RepoMetrics metrics = repoMetricsStore.computeIfAbsent(repo, k -> new RepoMetrics());
        metrics.totalReviews++;
        metrics.totalScore += data.getScore();
        metrics.averageScore = (double) metrics.totalScore / metrics.totalReviews;

        if (data.getIssues() != null) {
            metrics.totalIssues += data.getIssues().size();
            metrics.totalCritical += data.getIssues().stream()
                    .filter(i -> "CRITICAL".equalsIgnoreCase(i.getSeverity())).count();
        }
    }

    private int severityRank(String severity) {
        return switch (severity.toUpperCase()) {
            case "CRITICAL" -> 3;
            case "WARNING" -> 2;
            case "INFO" -> 1;
            default -> 0;
        };
    }

    /**
     * Aggregated metrics for a repository.
     */
    public static class RepoMetrics {
        public int totalReviews = 0;
        public int totalScore = 0;
        public double averageScore = 0;
        public long totalIssues = 0;
        public long totalCritical = 0;
    }
}
