# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A general-purpose template for building AI agents with local LLM support. Designed for containerized deployment with full observability. Can be adapted for various agentic use cases (document processing, data organization, automation tasks, etc.).

## Tech Stack

| Service | Purpose |
|---------|---------|
| **NestJS** | Backend framework |
| **LangChain** | Agent framework |
| **vLLM** | High-performance LLM inference (OpenAI-compatible API) |
| **PostgreSQL + pgvector** | Relational data + vector embeddings |
| **Prometheus** | Metrics collection |
| **Grafana** | Metrics visualization |
| **nvidia-dcgm-exporter** | GPU metrics for Prometheus |
| **Docker Compose** | Container orchestration |

## Docker Services

Expected services in `docker-compose.yml`:
- `app` - NestJS application
- `vllm` - LLM inference server
- `postgres` - Database with pgvector extension
- `prometheus` - Metrics scraping
- `grafana` - Dashboards and visualization
- `dcgm-exporter` - NVIDIA GPU metrics

## Database

PostgreSQL with pgvector handles all data storage:
- **Relational data** - Application/business data (standard tables)
- **Vector embeddings** - Semantic search via pgvector extension
- **Chat history** - Conversation logs (JSONB columns)

## Common Commands

```bash
# Development
npm run start:dev          # Start with hot reload (watches for changes)
npm run start:debug        # Debug mode with watch

# Build & Production
npm run build              # Compile TypeScript to dist/
npm run start:prod         # Run compiled production build

# Testing
npm run test               # Run unit tests
npm run test:watch         # Run unit tests in watch mode
npm run test:cov           # Run tests with coverage report
npm run test:e2e           # Run end-to-end tests

# Code Quality
npm run lint               # ESLint with auto-fix
npm run format             # Prettier formatting
```

## Architecture

Standard NestJS modular architecture:

- **Entry**: `src/main.ts` bootstraps the app, listens on `PORT` env var (default 3000)
- **Root Module**: `src/app.module.ts` - imports feature modules, registers controllers/providers
- **Pattern**: Controller → Service separation with dependency injection

### Testing Patterns

- **Unit tests**: Use `@nestjs/testing` `Test.createTestingModule()` to create isolated test modules
- **E2E tests**: Located in `test/`, use Supertest for HTTP assertions
- **File naming**: `*.spec.ts` for unit tests, `*.e2e-spec.ts` for E2E tests

## Code Style

- TypeScript strict mode with ES2023 target
- Single quotes, trailing commas (Prettier)
- ESLint flat config with TypeScript-ESLint

## Development Rules

- **Always update Postman collection** when adding or modifying API endpoints. The collection is at `postman/LangChain-Agent-API.postman_collection.json`.
- **Always use `--save`** when installing new npm packages (e.g., `npm install --save package-name`).
- **Run lint and build** before committing to catch TypeScript and ESLint errors.
