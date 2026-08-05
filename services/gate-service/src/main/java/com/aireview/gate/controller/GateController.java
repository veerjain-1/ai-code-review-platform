package com.aireview.gate.controller;

import com.aireview.gate.service.MetadataExtractionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * REST controller for gate service metrics and health.
 */
@RestController
@RequestMapping("/api/v1")
public class GateController {

    private final MetadataExtractionService metadataService;

    public GateController(MetadataExtractionService metadataService) {
        this.metadataService = metadataService;
    }

    /**
     * GET /api/v1/metrics
     * Get aggregated review metrics for all repositories.
     */
    @GetMapping("/metrics")
    public ResponseEntity<Map<String, MetadataExtractionService.RepoMetrics>> getMetrics() {
        return ResponseEntity.ok(metadataService.getAllRepoMetrics());
    }

    /**
     * GET /api/v1/metrics/{repo}
     * Get metrics for a specific repository.
     */
    @GetMapping("/metrics/{owner}/{repo}")
    public ResponseEntity<MetadataExtractionService.RepoMetrics> getRepoMetrics(
            @PathVariable String owner,
            @PathVariable String repo
    ) {
        String fullName = owner + "/" + repo;
        return ResponseEntity.ok(metadataService.getRepoMetrics(fullName));
    }

    /**
     * GET /api/v1/health
     * Health check endpoint for the gate service.
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "healthy",
                "service", "gate-service",
                "version", "1.0.0"
        ));
    }
}
