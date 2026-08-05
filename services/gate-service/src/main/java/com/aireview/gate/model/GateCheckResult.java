package com.aireview.gate.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Gate check evaluation result.
 */
public class GateCheckResult {

    @JsonProperty("reviewId")
    private String reviewId;

    @JsonProperty("repo")
    private String repo;

    @JsonProperty("branch")
    private String branch;

    @JsonProperty("passed")
    private boolean passed;

    @JsonProperty("verdict")
    private String verdict;  // APPROVED, BLOCKED, WARNING

    @JsonProperty("reasons")
    private List<String> reasons;

    @JsonProperty("metadata")
    private Map<String, Object> metadata;

    @JsonProperty("evaluatedAt")
    private String evaluatedAt;

    public GateCheckResult() {
        this.evaluatedAt = Instant.now().toString();
    }

    // Builder-style setters
    public GateCheckResult reviewId(String reviewId) { this.reviewId = reviewId; return this; }
    public GateCheckResult repo(String repo) { this.repo = repo; return this; }
    public GateCheckResult branch(String branch) { this.branch = branch; return this; }
    public GateCheckResult passed(boolean passed) { this.passed = passed; return this; }
    public GateCheckResult verdict(String verdict) { this.verdict = verdict; return this; }
    public GateCheckResult reasons(List<String> reasons) { this.reasons = reasons; return this; }
    public GateCheckResult metadata(Map<String, Object> metadata) { this.metadata = metadata; return this; }

    // Getters
    public String getReviewId() { return reviewId; }
    public String getRepo() { return repo; }
    public String getBranch() { return branch; }
    public boolean isPassed() { return passed; }
    public String getVerdict() { return verdict; }
    public List<String> getReasons() { return reasons; }
    public Map<String, Object> getMetadata() { return metadata; }
    public String getEvaluatedAt() { return evaluatedAt; }
}
