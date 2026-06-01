# Development Guide

This guide covers local development, when to run Tauri, how to test the reader/crawler flow, and how to add new novel sources.

## Do You Need Tauri?

For most UI and reader work, no. Run the web app:

```bash
npm run dev
```

Use Tauri when you need desktop-specific behavior:

- Real filesystem writes through `@tauri-apps/api/fs`.
- Rust command bridge changes in `src-tauri/src/main.rs`.
- Desktop packaging.
- Closer validation of app storage paths and Tauri APIs.

Browser dev mode is still useful because `src/core/storage/fsAdapter.ts` has a localStorage fallback. That lets you preview a source, crawl a small number of chapters, show the bookshelf, and open saved chapters without launching the desktop shell. Treat this as development storage only.

## Requirements

- Node.js 18+.
- npm.
- Rust toolchain for Tauri.
- Tauri OS prerequisites.
- Playwright browsers for crawler tests:

```bash
npm run playwright:install
```

On macOS this mostly downloads browser binaries. On Linux it may install system packages.

## Install

```bash
npm install
```

## Running The App

### Web Dev

```bash
npm run dev
```

Open the Vite URL, usually:

```text
http://127.0.0.1:5173/
```

Use this for:

- UI/UX work.
- Reader layout and appearance settings.
- Bookshelf behavior.
- Source adapter parsing when the source allows browser fetch.
- Small crawl smoke tests.

Limitations:

- Some sources block browser fetch through CORS.
- Large crawl-all jobs can be slow or rate-limited.
- Saved chapter files use localStorage fallback, not the real Tauri app directory.

### Tauri Dev

```bash
npm run tauri:dev
```

Use this for:

- Desktop filesystem behavior.
- Tauri API integration.
- Rust command bridge changes.
- Validating behavior closer to the desktop app.

The Tauri config in `src-tauri/tauri.conf.json` is still minimal.

### Build And Preview

```bash
npm run build
npm run preview
```

This builds/previews the frontend only.

### Tauri Build

```bash
npm run tauri:build
```

Use this after platform prerequisites and bundle settings are ready.

## Tests And Checks

Run the core validation set:

```bash
npm run typecheck
npm test -- --run
npm run build
```

Crawler CLI smoke test:

```bash
npm run crawl:demo
```

This runs `src/tauri-node/crawler.js` against `https://example.com` and verifies Node + Playwright can launch and emit JSON events.

On restricted macOS sandboxes, Playwright Chromium can fail with permission errors. Run the command from a normal terminal.

## Manual Flow Test

Sample WikiCV URL:

```text
https://wikicv.net/truyen/ngu-tien-mon-XyI88VS4CA5PobdX
```

Recommended dev flow:

1. Run `npm run dev`.
2. Open the app and switch to `Advanced`.
3. Paste the WikiCV URL, or click `Use WikiCV sample`.
4. Click `Preview`.
5. Confirm metadata appears: cover, title, author, status, chapter count, latest chapter.
6. Set `Chapter limit` to `3`.
7. Click `Confirm & crawl`.
8. Wait for `3/3 saved`.
9. Switch to `Reader`.
10. Confirm the bookshelf shows the novel.
11. Select the novel and confirm the chapter list appears.
12. Click `Start` or a chapter row.
13. Confirm reader content loads.
14. Open `Appearance` and test color, font, font size, and line height.

Avoid `Chapter limit = 0` during normal dev. `0` means all discovered chapters; for large novels this can take a long time.

## Project Structure

```text
src/components
  Reader, bookshelf/library, crawler, settings, TTS, glossary UI.

src/core/sources
  Source adapter contract and per-site adapters.

src/core/storage
  Tauri filesystem adapter, browser fallback, IndexedDB metadata/progress.

src/core/reader
  Reader store, content extraction, HTML sanitization helpers.

src/core/jobs
  Download queue.

src/core/crawler
  Generic crawler queue and browser/Playwright workers.

src/core/tts
  Browser Web Speech API wrapper.

src/core/translate
  Translator provider abstractions and cache.

src-tauri
  Rust/Tauri shell and command bridge.

src/tauri-node
  Node Playwright crawler process used by the Tauri bridge.
```

## Storage

### Browser Dev Mode

The filesystem adapter falls back to localStorage:

- `novel_tts_file:*`: file content.
- `novel_tts_web_novels`: novel index.
- `novel_tts_web_chapters:<novelId>`: chapter index.

Metadata and reading progress use IndexedDB database `novel_tts_db`.

### Tauri Mode

The intended desktop library path is:

```text
<appDir>/novel_tts/library/<novelId>/
  metadata.json
  chapters/ch_0001.json
  chapters/ch_0002.json
```

Metadata and progress are also stored in IndexedDB for UI queries.

## Adding A New Source

Source adapters implement `SourceAdapter` in `src/core/sources/SourceAdapter.ts`.

Required methods:

- `match(url)`: detect supported URLs.
- `getNovel(url)`: return metadata.
- `getChapters(url, opts)`: return chapter links and respect `opts.maxChapters`.
- `getChapter(url)`: return title and readable content.

Steps:

1. Create `src/core/sources/<source>.ts`.
2. Implement the adapter.
3. Export it from `src/core/sources/index.ts`.
4. Test with `Advanced -> Preview`.
5. Test with a small `Chapter limit`, usually `3`.
6. Add fixture tests before trusting large crawls.

Guidelines:

- Keep preview fast. `getChapters(url, { maxChapters: 3 })` should not scan the whole novel.
- Use absolute URLs.
- Keep app chapter IDs stable as `ch_0001`, `ch_0002`; keep source URLs in metadata.
- Extract readable content, not entire source pages.
- Add delay or lower concurrency for sources that rate-limit.
- Assume source HTML will change; selectors should fail clearly.

## WikiCV Notes

`src/core/sources/wikicv.ts` supports `wikicv.net`.

Current behavior:

- Metadata is parsed from `.book-info`.
- Chapter count is inferred from latest chapter text when available.
- Chapter discovery starts from chapter 1 and follows `Chương sau`.
- Preview intentionally discovers only a few chapters.

Risks:

- WikiCV may block/rate-limit browser fetch.
- Full crawls should use conservative limits and may be better through Tauri/Node.

## Crawler Notes

Current queue behavior is intentionally simple:

- Small concurrency.
- UI progress from `DownloadQueue` state.
- No persisted queue state yet.
- No pause/resume for active jobs yet.

Future crawler improvements:

- Persisted queue state.
- Pause/resume.
- Retry with backoff.
- Per-source rate limits.
- Better Tauri/Node crawler path for CORS-heavy sources.

## Reader UX Notes

Reader mode should stay focused:

- Bookshelf/detail on the side.
- Reading surface as the main workspace.
- Appearance controls in the reader toolbar.
- Advanced/debug/source tools outside the default reading flow.

When changing reader UI, validate:

- Desktop layout.
- Mobile width around `390px`.
- No horizontal overflow.
- Chapter content scroll performance.
- Last-read chapter updates after opening chapters.

## Common Problems

### Preview works but crawl fails

Likely CORS, rate limiting, or source markup changes. Try a smaller chapter limit, Tauri mode, or adapter delay/concurrency tuning.

### Bookshelf does not update

In web dev, inspect:

- DevTools -> Application -> Local Storage.
- DevTools -> Application -> IndexedDB -> `novel_tts_db`.

Reload after crawl if needed while developing.

### Tauri APIs fail in web dev

Expected. Tauri APIs only exist inside the Tauri shell.

### Playwright fails in sandbox

Run Playwright commands from a normal terminal. Restricted macOS sandboxes can block Chromium.

## Handoff Checklist

Before handing off changes:

```bash
npm run typecheck
npm test -- --run
npm run build
```

For source/crawler changes, also manually test:

- Preview on target URL.
- Small crawl limit.
- Bookshelf display.
- Open downloaded chapter.
