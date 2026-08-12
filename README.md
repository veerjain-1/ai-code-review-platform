# 🔍 AI Code Review Platform

A high-scale microservices backend providing automated AI-powered code reviews, utilizing secure RESTful APIs and LangChain for intelligent feedback loops integrated via Git hooks.

## Architecture

```
+-------------------------------------------------------------+
|                        Client Layer                         |
|  +--------------+  +--------------+  +-------------------+  |
|  |  Git Hooks   |  |  CLI Tool    |  |  GitHub Webhooks  |  |
|  +------+-------+  +------+-------+  +--------+----------+  |
+---------|-----------------|--------------------|-------------+
          |                 |                    |
          v                 v                    v
+-------------------------------------------------------------+
|              Node.js API Gateway (Express)                  |
|              POST /api/v1/reviews                           |
|              GET  /api/v1/reviews/:id                       |
|              GET  /api/v1/health                            |
+-------------------------+-----------------------------------+
                          | Kafka Producer
                          v
+-------------------------------------------------------------+
|                      Apache Kafka                           |
|              Topic: code-review-requests                    |
|              Topic: review-results                          |
|              Topic: gate-check-requests                     |
+----------+--------------------------+-----------------------+
           |                          |
           v                          v
+-------------------------+  +-----------------------------+
|  Node.js LangChain      |  |  Java Spring Boot           |
|  AI Review Worker        |  |  Gate Check Service         |
|                          |  |                             |
|  - Diff Analysis         |  |  - Severity Evaluation      |
|  - Code Quality Review   |  |  - Metadata Extraction      |
|  - Security Scanning     |  |  - Merge Gate Rules         |
|  - Structured Feedback   |  |  - Deployment Checks        |
+----------+---------------+  +--------------+--------------+
           |                                 |
           +--------------+-----------------+
                          v
                +-------------------+
                |  GitHub API       |
                |  PR Comments      |
                |  Status Checks    |
                +-------------------+
```

## Services

| Service | Technology | Port | Description |
|---------|-----------|------|-------------|
| `gateway` | Node.js + Express | 3000 | REST API ingestion gateway |
| `review-worker` | Node.js + LangChain | - | Kafka consumer, AI review engine |
| `gate-service` | Java + Spring Boot | 8080 | Gate checks & metadata extraction |
| `cli` | Node.js | - | Developer CLI tool |

## Quick Start

### Prerequisites
- Node.js >= 18
- Java >= 17
- Docker & Docker Compose (for Kafka)

### 1. Start Infrastructure
```bash
docker-compose up -d
```

### 2. Install & Run Services
```bash
# Gateway
cd services/gateway && npm install && npm run dev

# Review Worker
cd services/review-worker && npm install && npm run dev

# Gate Service
cd services/gate-service && ./gradlew bootRun
```

### 3. Install CLI
```bash
cd cli && npm install && npm link
```

### 4. Run a Review
```bash
# Review staged changes
ai-review review --staged

# Review a specific commit
ai-review review --commit HEAD~1

# Review a PR
ai-review review --pr https://github.com/org/repo/pull/1
```

## Configuration

Create a `.ai-review.yaml` in your project root:

```yaml
llm:
  provider: openai       # openai | anthropic | gemini
  model: gpt-4o
  temperature: 0.2

review:
  categories:
    - security
    - performance
    - code-quality
    - best-practices
  severity_threshold: WARNING  # CRITICAL | WARNING | INFO

gate_checks:
  max_critical_issues: 0
  max_warnings: 5
  require_tests: true
```

## License

MIT
