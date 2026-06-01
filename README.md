# Novel TTS

Local-first desktop/web scaffold for reading web novels, downloading chapters, saving a local library, and playing text through browser TTS. The app is built with Vite, React, TypeScript, Tailwind, Zustand, and a minimal Tauri shell.

## Business Scope

Novel TTS targets a personal novel reader workflow:

- Add a novel URL from a supported source.
- Crawl metadata and chapter links.
- Download chapter HTML/content into a local library.
- Open saved chapters in the reader and persist reading progress.
- Use browser text-to-speech controls for reading aloud.
- Keep translation and glossary abstractions ready for later AI-assisted translation.

## Current Status

Implemented:

- React UI panels for crawler, glossary, TTS, reader, library, and settings.
- Source adapter interface with initial `novelbin` and `truyenfull` adapters.
- Frontend crawler queue and download queue.
- Tauri command bridge that can spawn the Node Playwright crawler and stream `crawler-event` updates.
- Local storage split between Tauri filesystem JSON files and IndexedDB metadata/progress.
- Browser Web Speech API TTS controls.
- Translator provider abstractions for OpenAI, Gemini, Ollama, and DeepSeek-style providers.
- Basic glossary manager and seed glossary JSON files.
- Minimal Vitest coverage for reader store shape.

Still scaffold-level:

- The main screen is a developer demo dashboard, not yet a polished reader product.
- Crawling selectors are basic and may fail when websites change markup or block CORS/automation.
- Chapter download currently saves raw fetched HTML in the frontend path.
- Translation providers are not wired into the UI flow.
- Settings currently persist values but are not fully applied across the reader UI.
- Test coverage is very thin.

## Requirements

- Node.js 18+ recommended.
- npm.
- Rust toolchain and platform-specific Tauri prerequisites for desktop mode.
- Playwright browsers for crawler features that use Node/Chromium.

## Install

```bash
npm install
```

Install Playwright browsers when using crawler features:

```bash
npm run playwright:install
```

On Linux, `playwright:install` may install system packages. On macOS it mainly downloads browser binaries.

## Run

Frontend web dev server:

```bash
npm run dev
```

Tauri desktop dev mode:

```bash
npm run tauri:dev
```

Crawler CLI smoke test:

```bash
npm run crawl:demo
```

The demo crawler points at `https://example.com`, so it only verifies that the Node Playwright crawler can launch and emit JSON events.

## Test And Validate

Run unit tests:

```bash
npm test -- --run
```

Run TypeScript typecheck:

```bash
npm run typecheck
```

Build production frontend:

```bash
npm run build
```

Preview the built frontend:

```bash
npm run preview
```

## Storage

The app stores library content under the Tauri app directory when running in Tauri:

```text
<appDir>/novel_tts/library/<novelId>/
  metadata.json
  chapters/<chapterId>.json
```

In browser-only mode, the filesystem adapter falls back to a relative `library` path, but Tauri filesystem APIs are still required for real file writes. Novel metadata and reader progress are stored in IndexedDB.

## Architecture

- `src/components`: UI panels and reusable display components.
- `src/core/crawler`: queue, browser worker, Playwright worker, and crawler types.
- `src/core/sources`: source adapter contract and source-specific parsers.
- `src/core/storage`: Tauri filesystem and IndexedDB adapters.
- `src/core/reader`: reader store and chapter loading.
- `src/core/tts`: browser TTS wrapper.
- `src/core/translate`: translator provider contract, cache, and provider implementations.
- `src/core/glossary`: glossary manager and seed glossary files.
- `src-tauri`: Tauri configuration and Rust command bridge.
- `src/tauri-node/crawler.js`: Node Playwright crawler used by the Tauri bridge.

## Known Issues And Improvement Plan

High priority:

- Add real end-to-end crawler tests with fixture HTML for each source adapter.
- Normalize downloaded chapters to safe reader content instead of storing raw full-page HTML.
- Replace `dangerouslySetInnerHTML` with sanitized content rendering.
- Make reader open real chapter IDs from library metadata instead of defaulting to chapter `1`.
- Wire settings into reader typography/theme consistently.
- Add UI states for crawler errors, empty adapter matches, unsupported sites, and failed filesystem writes.

Medium priority:

- Add `lint` and stronger test scripts to CI.
- Avoid global `process`/`EventEmitter` browser polyfills in `index.html`; isolate any Node-only dependencies from the browser bundle.
- Persist crawler/download queue state so interrupted downloads can resume.
- Add cancellation for active download jobs, not only queued crawler jobs.
- Improve backend process cleanup after normal crawler exit.
- Add provider configuration UI for translation keys/endpoints.

Low priority:

- Polish responsive layout and move from demo panels to a reader-first information architecture.
- Add import/export for library and glossary data.
- Add packaging notes per OS once Tauri build flow is finalized.

## Verification Snapshot

Last verified locally:

```bash
npm run typecheck
npm test -- --run
npm run build
npm run crawl:demo
```

All commands pass when Playwright Chromium is allowed to launch. In a restricted sandbox on macOS, `npm run crawl:demo` can fail with a Chromium Mach port permission error; rerun it in a normal terminal.

`npm run build` still emits Vite warnings about browser externalization of `process` and `events` from the current `index.html` polyfill script, plus a Tauri dynamic import chunking warning.
