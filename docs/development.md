# Development Guide

## Requirements

- Node.js 20+.
- npm.
- PostgreSQL 14+ or Docker.
- Playwright Chromium for browser fallback.

Install packages and Playwright:

```bash
npm install
npm run playwright:install
```

## Environment

Copy `.env.example` to `.env` when overriding local defaults. The API loads
`.env` automatically through `dotenv`.

Default local database:

```text
postgres://postgres:postgres@127.0.0.1:5432/novel_tts
```

The credentials match `compose.yaml`.

## Run Modes

### Full Web Stack

```bash
docker compose up -d postgres
npm run dev:all
```

- Vite: `http://127.0.0.1:5173`
- Fastify: `http://127.0.0.1:8787`
- Vite proxies `/api` to Fastify.
- The API runs database migration before listening.
- The crawl worker runs in the API process.

### Frontend Only

```bash
npm run dev
```

Use this for isolated UI work. Library, reader data, and crawling require the
API and PostgreSQL.

### API Only

```bash
npm run dev:api
```

Use this for Fastify routes, crawler worker, PostgreSQL, or Playwright work.

## Validation

```bash
npm run typecheck
npm run typecheck:server
npm test -- --run
npm run build
```

## Manual WikiCV Test

1. Start PostgreSQL and `npm run dev:all`.
2. Open Admin -> Crawl.
3. Use the WikiCV sample URL.
4. Preview and start a job with limit `3`.
5. Confirm SSE progress reaches `done`.
6. Query `GET /api/novels` and the novel chapter endpoint.

Avoid chapter limit `0` during development. It means crawl until no next
chapter is found or the server safety limit is reached.

## Advanced Crawl Recovery

Advanced jobs persist:

- Current chapter URL.
- Completed and failed counts.
- One `crawl_job_items` row per chapter.
- Attempt count and last error.
- The next URL when it was available.

The worker retries failed chapters with exponential backoff. If the next URL is
unknown, as with a WikiCV `503` response, the job becomes `paused`. Previously
downloaded chapters stay in PostgreSQL. Resume retries the blocked chapter
instead of starting from chapter 1.

`Skip failed` only works when the failed page was parsed far enough to discover
its next URL. WikiCV navigation is sequential, so a total fetch failure cannot
be skipped safely.

`Retry failed at end` retries skipped items after the main crawl. Remaining
failures produce `done_with_errors` and can be resumed again.

Starting a crawl for the same source URL resumes the latest persisted job.
Completed jobs can resume with a larger chapter limit. If a novel was
previously at its final chapter, the worker checks that chapter again for a new
`Chuong sau` link.

If fallback reports that Chromium is missing:

```bash
npm run playwright:install
```

Restart `npm run dev:api` after migration or crawler code changes.

## Adding A Source

### Shared Parsing

Put transport-independent parsing code in:

```text
src/core/sources/parsers/
```

Parser functions receive an `HtmlDocument`; they must not call `fetch`, access
PostgreSQL, or depend directly on browser globals.

### Source Adapter

Add the browser adapter under:

```text
src/core/sources/<source>.ts
```

Keep source parsing transport-independent so the backend runner can reuse it.

### Advanced Backend Runner

Add backend orchestration under:

```text
server/crawler/<source>.ts
```

It chooses HTTP/Playwright transport, invokes the shared parser, and persists
through `server/db/repository.ts`.

Register source routing in `server/routes/crawl.ts` and worker dispatch in
`server/crawler/worker.ts`.

### Tests

Add fixture-based parser tests next to the parser. Do not rely only on live-site
tests because markup and network behavior are unstable.

## Operational Notes

- Backend URLs are restricted by `CRAWL_ALLOWED_HOSTS`.
- URL resolution rejects private and loopback IP addresses.
- HTTP fetch is attempted before Playwright.
- Requests to the same host are paced by `CRAWL_MIN_DELAY_MS` plus random
  `CRAWL_DELAY_JITTER_MS`.
- `429` and `503` responses honor `Retry-After` or
  `CRAWL_RATE_LIMIT_COOLDOWN_MS`. A `403` uses the longer
  `CRAWL_FORBIDDEN_COOLDOWN_MS`.
- Playwright fallback is skipped for `403`, `429`, and `503` so a blocked HTTP
  request is not immediately followed by another browser request.
- Crawl concurrency is intentionally one worker at present.
- PostgreSQL stores jobs, library metadata, chapter content, and reading
  progress.
