# Architecture

## Muc tieu

Du an theo huong web-first:

- React/Vite phu trach UI va Basic crawl.
- Fastify phu trach API.
- PostgreSQL luu Advanced crawl jobs, novel va chapters.
- Worker backend xu ly crawl dai, retry/cancel va Playwright fallback.

## Luong du lieu

### Basic crawl

```text
React
  -> browser fetch
  -> browser HtmlDocument
  -> shared source parser
  -> IndexedDB/localStorage
```

Basic phu hop preview va crawl nho. No bi gioi han boi CORS va vong doi cua tab.

### Advanced crawl

```text
React
  -> Fastify route
  -> PostgreSQL crawl job
  -> worker
     -> HTTP fetch
     -> Playwright fallback
     -> Cheerio HtmlDocument
     -> shared source parser
     -> PostgreSQL
  -> SSE progress
```

Advanced tiep tuc chay khi tab dong, co persisted state va khong bi browser CORS.

## Folder Ownership

```text
server/
  app.ts                 Fastify bootstrap and common plugins
  index.ts               process lifecycle
  config.ts              environment configuration
  routes/                HTTP validation, status codes, SSE
  crawler/               transport, source orchestration, worker
  db/                    pool, schema migration, repository

src/
  components/            React UI
  pages/                 page composition
  stores/                Zustand UI state
  core/backend/          typed frontend API client
  core/sources/          browser source adapters
  core/sources/parsers/  parser code shared by frontend/backend
  core/jobs/             Basic browser download queue
  core/storage/          browser-local storage
  core/reader/           reader state and content normalization
  core/tts/              browser TTS
  core/translate/        translation provider abstractions
  core/glossary/         glossary rules
```

## Dependency Rules

1. Shared parsers do not fetch, persist, or import browser/Node frameworks.
2. Browser adapters may depend on shared parsers, never on `server/`.
3. Backend crawler modules may depend on shared parsers and `server/db`.
4. Fastify routes validate HTTP input and delegate work; they do not parse HTML.
5. Repository modules own SQL; UI and crawler modules do not issue SQL directly.

## WikiCV

WikiCV uses one parser for both paths:

```text
Basic:    fetch -> DOMParser wrapper -> WikiCV parser
Advanced: HTTP/Playwright -> Cheerio wrapper -> WikiCV parser
```

The backend processes a chapter and discovers `Chuong sau` from the same HTML,
so each chapter is normally fetched only once.

## PostgreSQL

Main tables:

- `novels`
- `chapters`
- `crawl_jobs`
- `crawl_job_items`

The current worker claims jobs with `FOR UPDATE SKIP LOCKED`. One worker loop is
started in the API process. Split it into a separate process only when deployment
or load requires independent scaling.

Each crawl item persists its URL, position, state, attempts, error and known
next URL. A blocking navigation failure pauses the job at that URL. Worker
restart requeues interrupted jobs, and explicit resume continues from persisted
state.

## Known Technical Debt

- `ReaderPanel`, `CrawlerPanel`, and `LibraryPanel` are large UI components.
  Split them by view responsibility when their behavior next changes.
- Advanced backend support currently exists only for WikiCV.
- Basic and Advanced libraries are not yet presented as one unified data source.
- Basic data is browser-local while Advanced data is stored in PostgreSQL.
- SQL migration is idempotent schema setup, not a versioned migration system.
- Multi-worker coordination needs broader integration tests before production
  deployment.
