const { Kafka, logLevel } = require('kafkajs');

const TOPICS = {
  REVIEW_REQUESTS: 'code-review-requests',
  REVIEW_RESULTS: 'review-results',
  GATE_CHECK_REQUESTS: 'gate-check-requests',
};

class KafkaConsumer {
  constructor() {
    this.kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || 'ai-review-worker',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:19092').split(','),
      logLevel: logLevel.WARN,
      retry: { initialRetryTime: 1000, retries: 8 },
    });

    this.consumer = this.kafka.consumer({
      groupId: process.env.KAFKA_CONSUMER_GROUP || 'ai-review-workers',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });

    this.producer = this.kafka.producer();
    this.messageHandler = null;
  }

  /**
   * Register a handler for incoming review requests.
   * @param {Function} handler - async (payload) => void
   */
  onMessage(handler) {
    this.messageHandler = handler;
  }

  /**
   * Start consuming messages from the review-requests topic.
   */
  async start() {
    await this.consumer.connect();
    await this.producer.connect();

    console.log('📡 Kafka consumer connected');
    console.log(`📥 Subscribing to topic: ${TOPICS.REVIEW_REQUESTS}`);

    await this.consumer.subscribe({
      topic: TOPICS.REVIEW_REQUESTS,
      fromBeginning: false,
    });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!this.messageHandler) return;

        try {
          const payload = JSON.parse(message.value.toString());
          const correlationId = message.headers?.['correlation-id']?.toString();

          console.log(`📨 Received message [partition=${partition}] correlationId=${correlationId}`);

          await this.messageHandler(payload);
        } catch (err) {
          console.error('❌ Error processing message:', err.message);
        }
      },
    });

    console.log('🎧 Worker listening for review requests...\n');
  }

  /**
   * Publish review results back to Kafka.
   * @param {Object} result - The review result payload
   */
  async publishResult(result) {
    // Publish to review-results topic
    await this.producer.send({
      topic: TOPICS.REVIEW_RESULTS,
      messages: [{
        key: result.reviewId,
        value: JSON.stringify(result),
        headers: {
          'correlation-id': result.reviewId,
          'source': 'review-worker',
        },
      }],
    });

    // Also publish to gate-check-requests for the Java service
    if (result.status === 'COMPLETED') {
      await this.producer.send({
        topic: TOPICS.GATE_CHECK_REQUESTS,
        messages: [{
          key: result.reviewId,
          value: JSON.stringify(result),
          headers: {
            'correlation-id': result.reviewId,
            'source': 'review-worker',
          },
        }],
      });
    }
  }

  /**
   * Stop the consumer gracefully.
   */
  async stop() {
    await this.consumer.disconnect();
    await this.producer.disconnect();
    console.log('📡 Kafka consumer disconnected');
  }
}

module.exports = { KafkaConsumer, TOPICS };
