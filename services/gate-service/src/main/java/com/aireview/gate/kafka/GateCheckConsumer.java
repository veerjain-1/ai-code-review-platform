package com.aireview.gate.kafka;

import com.aireview.gate.model.GateCheckResult;
import com.aireview.gate.model.ReviewResult;
import com.aireview.gate.service.GateCheckService;
import com.aireview.gate.service.MetadataExtractionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Kafka consumer that listens for gate-check-requests from the AI review worker,
 * evaluates them against gate rules, and publishes results.
 */
@Component
public class GateCheckConsumer {

    private static final Logger log = LoggerFactory.getLogger(GateCheckConsumer.class);
    private static final String RESULT_TOPIC = "gate-check-results";

    private final GateCheckService gateCheckService;
    private final MetadataExtractionService metadataService;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public GateCheckConsumer(
            GateCheckService gateCheckService,
            MetadataExtractionService metadataService,
            KafkaTemplate<String, String> kafkaTemplate
    ) {
        this.gateCheckService = gateCheckService;
        this.metadataService = metadataService;
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = new ObjectMapper();
    }

    @KafkaListener(topics = "gate-check-requests", groupId = "gate-check-workers")
    public void onGateCheckRequest(String message) {
        try {
            ReviewResult review = objectMapper.readValue(message, ReviewResult.class);

            log.info("📥 Received gate check request for review: {}", review.getReviewId());

            // ─── Step 1: Extract metadata ───
            Map<String, Object> metadata = metadataService.extractMetadata(review);
            log.info("📊 Metadata extracted: {} fields", metadata.size());

            // ─── Step 2: Evaluate gate rules ───
            GateCheckResult result = gateCheckService.evaluate(review);

            // ─── Step 3: Publish result ───
            String resultJson = objectMapper.writeValueAsString(result);
            kafkaTemplate.send(RESULT_TOPIC, review.getReviewId(), resultJson);

            log.info("📤 Gate check result published: {} — verdict: {} (passed: {})",
                    review.getReviewId(), result.getVerdict(), result.isPassed());

        } catch (Exception e) {
            log.error("❌ Failed to process gate check request", e);
        }
    }
}
