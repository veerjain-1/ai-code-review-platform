package com.aireview.gate.service;

import com.aireview.gate.config.GateRulesConfig;
import com.aireview.gate.model.GateCheckResult;
import com.aireview.gate.model.ReviewResult;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Core gate check evaluation engine.
 * Evaluates AI review results against configurable rules to determine
 * whether a PR/commit should be approved or blocked.
 */
@Service
public class GateCheckService {

    private static final Logger log = LoggerFactory.getLogger(GateCheckService.class);

    private final GateRulesConfig rules;

    public GateCheckService(GateRulesConfig rules) {
        this.rules = rules;
        log.info("Gate check service initialized with rules: {}", rules);
    }

    /**
     * Evaluate a review result against gate check rules.
     *
     * @param review The review result from the AI worker
     * @return GateCheckResult with pass/fail verdict and reasons
     */
    public GateCheckResult evaluate(ReviewResult review) {
        log.info("Evaluating gate check for review: {} (repo: {}, branch: {})",
                review.getReviewId(), review.getRepo(), review.getBranch());

        List<String> blockReasons = new ArrayList<>();
        List<String> warnReasons = new ArrayList<>();
        Map<String, Object> metadata = new LinkedHashMap<>();

        ReviewResult.ReviewData data = review.getResult();
        if (data == null || data.getIssues() == null) {
            log.warn("Review {} has no result data, auto-approving", review.getReviewId());
            return new GateCheckResult()
                    .reviewId(review.getReviewId())
                    .repo(review.getRepo())
                    .branch(review.getBranch())
                    .passed(true)
                    .verdict("APPROVED")
                    .reasons(List.of("No review data available — auto-approved"))
                    .metadata(Map.of("score", 0));
        }

        List<ReviewResult.ReviewIssue> issues = data.getIssues();

        // ─── Rule 1: Critical Issues Count ───
        long criticalCount = issues.stream()
                .filter(i -> "CRITICAL".equalsIgnoreCase(i.getSeverity()))
                .count();

        metadata.put("critical_issues", criticalCount);

        if (criticalCount > rules.getMaxCriticalIssues()) {
            blockReasons.add(String.format(
                    "CRITICAL issues found: %d (max allowed: %d)",
                    criticalCount, rules.getMaxCriticalIssues()
            ));
        }

        // ─── Rule 2: Warning Count ───
        long warningCount = issues.stream()
                .filter(i -> "WARNING".equalsIgnoreCase(i.getSeverity()))
                .count();

        metadata.put("warning_issues", warningCount);

        if (warningCount > rules.getMaxWarnings()) {
            warnReasons.add(String.format(
                    "WARNING issues exceed threshold: %d (max allowed: %d)",
                    warningCount, rules.getMaxWarnings()
            ));
        }

        // ─── Rule 3: Security Issues ───
        if (rules.isBlockOnSecurityIssues()) {
            List<ReviewResult.ReviewIssue> securityIssues = issues.stream()
                    .filter(i -> "security".equalsIgnoreCase(i.getCategory()))
                    .filter(i -> "CRITICAL".equalsIgnoreCase(i.getSeverity()))
                    .collect(Collectors.toList());

            metadata.put("security_issues", securityIssues.size());

            if (!securityIssues.isEmpty()) {
                blockReasons.add(String.format(
                        "Security vulnerabilities detected: %d critical security issue(s)",
                        securityIssues.size()
                ));

                // Log specific security issues
                securityIssues.forEach(si ->
                        log.warn("🔒 Security issue in {}: {} - {}",
                                si.getFile(), si.getTitle(), si.getDescription())
                );
            }
        }

        // ─── Rule 4: Diff Size (from metadata) ───
        if (data.getMetadata() != null) {
            int totalChanges = data.getMetadata().getTotalAdditions() + data.getMetadata().getTotalDeletions();
            metadata.put("total_changes", totalChanges);

            if (totalChanges > rules.getMaxDiffSize()) {
                warnReasons.add(String.format(
                        "Large diff detected: %d lines changed (recommended max: %d). Consider splitting into smaller PRs.",
                        totalChanges, rules.getMaxDiffSize()
                ));
            }
        }

        // ─── Rule 5: Test Coverage for New Files ───
        if (rules.isRequireTestsForNewFiles() && data.getMetadata() != null) {
            List<String> newFiles = issues.stream()
                    .map(ReviewResult.ReviewIssue::getFile)
                    .distinct()
                    .collect(Collectors.toList());

            boolean hasTestFiles = newFiles.stream()
                    .anyMatch(f -> f.contains("test") || f.contains("spec") || f.contains("Test"));

            metadata.put("has_test_files", hasTestFiles);

            if (!hasTestFiles && newFiles.size() > 3) {
                warnReasons.add("No test files detected in a multi-file change. Consider adding tests.");
            }
        }

        // ─── Compute Score and Metadata ───
        metadata.put("ai_score", data.getScore());
        metadata.put("total_issues", issues.size());
        metadata.put("info_issues", issues.stream()
                .filter(i -> "INFO".equalsIgnoreCase(i.getSeverity())).count());

        // Extract language metadata
        if (data.getMetadata() != null && data.getMetadata().getLanguagesDetected() != null) {
            metadata.put("languages", data.getMetadata().getLanguagesDetected());
        }

        // ─── Final Verdict ───
        boolean passed;
        String verdict;
        List<String> allReasons = new ArrayList<>();

        if (!blockReasons.isEmpty()) {
            passed = false;
            verdict = "BLOCKED";
            allReasons.addAll(blockReasons);
            allReasons.addAll(warnReasons);
            log.warn("❌ Gate check BLOCKED for review {} — {} block reason(s)",
                    review.getReviewId(), blockReasons.size());
        } else if (!warnReasons.isEmpty()) {
            passed = true;
            verdict = "WARNING";
            allReasons.addAll(warnReasons);
            log.info("⚠️ Gate check PASSED with warnings for review {}", review.getReviewId());
        } else {
            passed = true;
            verdict = "APPROVED";
            allReasons.add("All gate checks passed. Code is clear for merge.");
            log.info("✅ Gate check APPROVED for review {}", review.getReviewId());
        }

        return new GateCheckResult()
                .reviewId(review.getReviewId())
                .repo(review.getRepo())
                .branch(review.getBranch())
                .passed(passed)
                .verdict(verdict)
                .reasons(allReasons)
                .metadata(metadata);
    }
}
