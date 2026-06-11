# Novel TTS

Web novel reader and crawler built with React, Fastify, PostgreSQL, and
Playwright.

## Current Capabilities

- Browser reader, bookshelf, reading progress, TTS, glossary, and settings.
- Basic crawl in the browser for supported sources that allow CORS.
- Advanced WikiCV crawl through a persisted PostgreSQL job.
- Per-chapter retry state with pause/resume and failed-item tracking.
- HTTP-first backend fetch with Playwright fallback.
- Shared WikiCV parser used by both browser and backend transports.
- Browser-local storage for Basic crawl and reader progress.

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

Use `Basic` for a small browser-side crawl. Use `Advanced` for the Fastify
backend, persisted jobs, PostgreSQL storage, and Playwright fallback.

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

| Source | Basic browser crawl | Advanced backend crawl |
| --- | --- | --- |
| WikiCV | Yes | Yes |
| NovelBin | Scaffold-level | Not implemented |
| TruyenFull | Scaffold-level | Not implemented |

Source markup can change. Keep crawl limits small until fixture tests confirm an
adapter still matches the live site.

Install Playwright Chromium before relying on browser fallback:

```bash
npm run playwright:install
```
