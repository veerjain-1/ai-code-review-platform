package com.aireview.gate.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

/**
 * Represents the result of an AI code review.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class ReviewResult {

    @JsonProperty("reviewId")
    private String reviewId;

    @JsonProperty("repo")
    private String repo;

    @JsonProperty("branch")
    private String branch;

    @JsonProperty("pr_url")
    private String prUrl;

    @JsonProperty("pr_number")
    private Integer prNumber;

    @JsonProperty("commit_sha")
    private String commitSha;

    @JsonProperty("status")
    private String status;

    @JsonProperty("result")
    private ReviewData result;

    @JsonProperty("completedAt")
    private String completedAt;

    // Getters and setters
    public String getReviewId() { return reviewId; }
    public void setReviewId(String reviewId) { this.reviewId = reviewId; }

    public String getRepo() { return repo; }
    public void setRepo(String repo) { this.repo = repo; }

    public String getBranch() { return branch; }
    public void setBranch(String branch) { this.branch = branch; }

    public String getPrUrl() { return prUrl; }
    public void setPrUrl(String prUrl) { this.prUrl = prUrl; }

    public Integer getPrNumber() { return prNumber; }
    public void setPrNumber(Integer prNumber) { this.prNumber = prNumber; }

    public String getCommitSha() { return commitSha; }
    public void setCommitSha(String commitSha) { this.commitSha = commitSha; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public ReviewData getResult() { return result; }
    public void setResult(ReviewData result) { this.result = result; }

    public String getCompletedAt() { return completedAt; }
    public void setCompletedAt(String completedAt) { this.completedAt = completedAt; }

    /**
     * Inner class representing the AI review data.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ReviewData {

        @JsonProperty("summary")
        private String summary;

        @JsonProperty("score")
        private int score;

        @JsonProperty("issues")
        private List<ReviewIssue> issues;

        @JsonProperty("highlights")
        private List<String> highlights;

        @JsonProperty("metadata")
        private ReviewMetadata metadata;

        public String getSummary() { return summary; }
        public void setSummary(String summary) { this.summary = summary; }

        public int getScore() { return score; }
        public void setScore(int score) { this.score = score; }

        public List<ReviewIssue> getIssues() { return issues; }
        public void setIssues(List<ReviewIssue> issues) { this.issues = issues; }

        public List<String> getHighlights() { return highlights; }
        public void setHighlights(List<String> highlights) { this.highlights = highlights; }

        public ReviewMetadata getMetadata() { return metadata; }
        public void setMetadata(ReviewMetadata metadata) { this.metadata = metadata; }
    }

    /**
     * Represents a single review issue.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ReviewIssue {

        @JsonProperty("file")
        private String file;

        @JsonProperty("line_start")
        private int lineStart;

        @JsonProperty("line_end")
        private int lineEnd;

        @JsonProperty("severity")
        private String severity;

        @JsonProperty("category")
        private String category;

        @JsonProperty("title")
        private String title;

        @JsonProperty("description")
        private String description;

        @JsonProperty("suggestion")
        private String suggestion;

        @JsonProperty("confidence")
        private double confidence;

        // Getters
        public String getFile() { return file; }
        public int getLineStart() { return lineStart; }
        public int getLineEnd() { return lineEnd; }
        public String getSeverity() { return severity; }
        public String getCategory() { return category; }
        public String getTitle() { return title; }
        public String getDescription() { return description; }
        public String getSuggestion() { return suggestion; }
        public double getConfidence() { return confidence; }

        // Setters
        public void setFile(String file) { this.file = file; }
        public void setLineStart(int lineStart) { this.lineStart = lineStart; }
        public void setLineEnd(int lineEnd) { this.lineEnd = lineEnd; }
        public void setSeverity(String severity) { this.severity = severity; }
        public void setCategory(String category) { this.category = category; }
        public void setTitle(String title) { this.title = title; }
        public void setDescription(String description) { this.description = description; }
        public void setSuggestion(String suggestion) { this.suggestion = suggestion; }
        public void setConfidence(double confidence) { this.confidence = confidence; }
    }

    /**
     * Review metadata.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ReviewMetadata {

        @JsonProperty("files_reviewed")
        private int filesReviewed;

        @JsonProperty("total_additions")
        private int totalAdditions;

        @JsonProperty("total_deletions")
        private int totalDeletions;

        @JsonProperty("languages_detected")
        private List<String> languagesDetected;

        public int getFilesReviewed() { return filesReviewed; }
        public void setFilesReviewed(int filesReviewed) { this.filesReviewed = filesReviewed; }

        public int getTotalAdditions() { return totalAdditions; }
        public void setTotalAdditions(int totalAdditions) { this.totalAdditions = totalAdditions; }

        public int getTotalDeletions() { return totalDeletions; }
        public void setTotalDeletions(int totalDeletions) { this.totalDeletions = totalDeletions; }

        public List<String> getLanguagesDetected() { return languagesDetected; }
        public void setLanguagesDetected(List<String> languagesDetected) { this.languagesDetected = languagesDetected; }
    }
}
