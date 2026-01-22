# LangChain Agent NestJS Template

A general-purpose template for building AI agents with local LLM support. Designed for containerized deployment with full observability.

## Tech Stack

| Service | Purpose |
|---------|---------|
| **NestJS** | Backend framework |
| **LangChain** | Agent framework |
| **vLLM** | High-performance LLM inference (OpenAI-compatible API) |
| **PostgreSQL + pgvector** | Relational data + vector embeddings |
| **Prometheus** | Metrics collection |
| **Grafana** | Metrics visualization |
| **nvidia-dcgm-exporter** | GPU metrics |

## Prerequisites

- Docker and Docker Compose
- NVIDIA GPU with CUDA support
- NVIDIA Container Toolkit installed

## Quick Start

1. **Clone and configure environment:**

```bash
cp .env.example .env
```

2. **Set required environment variables in `.env`:**

```bash
MODEL=mistralai/Mistral-7B-Instruct-v0.3  # or your preferred model
HF_TOKEN=your_huggingface_token           # required for gated models
POSTGRES_PASSWORD=your_secure_password
GRAFANA_ADMIN_PASSWORD=your_admin_password
```

3. **Start all services:**

```bash
docker-compose up -d
```

4. **Access services:**

| Service | URL |
|---------|-----|
| NestJS App | http://localhost:3000 |
| vLLM API | http://localhost:8000 |
| Grafana | http://localhost:3001 |
| Prometheus | http://localhost:9090 |

## Development

```bash
# Install dependencies
npm install

# Development with hot reload
npm run start:dev

# Debug mode
npm run start:debug

# Production build
npm run build
npm run start:prod
```

## Testing

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# E2E tests
npm run test:e2e
```

## Docker Services

```yaml
services:
  app:           # NestJS application (port 3000)
  vllm:          # vLLM inference server (port 8000)
  postgres:      # PostgreSQL + pgvector (port 5432)
  prometheus:    # Metrics collection (port 9090)
  grafana:       # Dashboards (port 3001)
  dcgm-exporter: # GPU metrics (port 9400)
```

## Grafana Dashboards

Pre-configured dashboards are automatically provisioned:

- **GPU Metrics** - Utilization, memory, temperature, power consumption
- **vLLM Metrics** - Request rate, latency percentiles, token throughput, KV cache usage

## Project Structure

```
├── src/
│   ├── main.ts              # Application entry point
│   └── app.module.ts        # Root module
├── docker/
│   ├── prometheus/          # Prometheus configuration
│   ├── grafana/             # Grafana provisioning
│   └── postgres/            # PostgreSQL init scripts
├── docker-compose.yml       # Container orchestration
├── Dockerfile               # Multi-stage build
└── .env.example             # Environment template
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MODEL` | vLLM model to serve | Yes |
| `HF_TOKEN` | HuggingFace token (for gated models) | Conditional |
| `POSTGRES_USER` | Database user | Yes |
| `POSTGRES_PASSWORD` | Database password | Yes |
| `POSTGRES_DB` | Database name | Yes |
| `GRAFANA_ADMIN_PASSWORD` | Grafana admin password | Yes |

## License

MIT
