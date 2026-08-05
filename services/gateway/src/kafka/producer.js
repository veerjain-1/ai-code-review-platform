const { Kafka, logLevel } = require('kafkajs');

const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID || 'ai-review-gateway',
  brokers: (process.env.KAFKA_BROKERS || 'localhost:19092').split(','),
  logLevel: logLevel.WARN,
  retry: {
    initialRetryTime: 1000,
    retries: 8,
  },
});

const producer = kafka.producer({
  allowAutoTopicCreation: true,
  transactionTimeout: 30000,
});

const TOPICS = {
  REVIEW_REQUESTS: 'code-review-requests',
  REVIEW_RESULTS: 'review-results',
  GATE_CHECK_REQUESTS: 'gate-check-requests',
  GATE_CHECK_RESULTS: 'gate-check-results',
};

/**
 * Connect the Kafka producer.
 */
async function connectProducer() {
  await producer.connect();
}

/**
 * Disconnect the Kafka producer.
 */
async function disconnectProducer() {
  await producer.disconnect();
}

/**
 * Publish a review request to Kafka.
 * @param {Object} payload - The review request payload
 * @returns {Object} - Kafka send result
 */
async function publishReviewRequest(payload) {
  const message = {
    key: payload.reviewId,
    value: JSON.stringify(payload),
    headers: {
      'correlation-id': payload.reviewId,
      'source': 'gateway',
      'timestamp': Date.now().toString(),
    },
  };

  const result = await producer.send({
    topic: TOPICS.REVIEW_REQUESTS,
    messages: [message],
  });

  return result;
}

module.exports = {
  kafka,
  producer,
  TOPICS,
  connectProducer,
  disconnectProducer,
  publishReviewRequest,
};
