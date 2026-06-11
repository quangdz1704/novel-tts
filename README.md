# Novel TTS

Web novel reader and crawler built with React, Fastify, PostgreSQL, and
Playwright.

## Current Capabilities

- Browser reader, bookshelf, reading progress, TTS, glossary, and settings.
- WikiCV crawl through a persisted PostgreSQL job.
- Per-chapter retry state with pause/resume and failed-item tracking.
- HTTP-first backend fetch with Playwright fallback.
- PostgreSQL-backed novels, chapters, crawl jobs, and reading progress.

## Quick Start

Install dependencies:

```bash
npm install
```

Start PostgreSQL and the complete web stack:

```bash
docker compose up -d postgres
npm run dev:all
```

Open:

```text
http://127.0.0.1:5173
```

The frontend talks to Fastify for crawling, library data, chapter content, and
reading progress.

## Common Commands

```bash
npm run dev              # Vite frontend only
npm run dev:api          # Fastify API and worker only
npm run dev:all          # frontend + API
npm run db:migrate       # create/update PostgreSQL tables
npm run typecheck
npm run typecheck:server
npm test -- --run
npm run build
```

## Documentation

- [Development guide](docs/development.md)
- [Architecture](docs/architecture.md)

## Support Status

| Source | Backend crawl |
| --- | --- |
| WikiCV | Yes |
| NovelBin | Not implemented |
| TruyenFull | Not implemented |

Source markup can change. Keep crawl limits small until fixture tests confirm an
adapter still matches the live site.

Install Playwright Chromium before relying on browser fallback:

```bash
npm run playwright:install
```
