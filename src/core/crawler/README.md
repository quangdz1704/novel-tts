# Crawler Queue

This module implements a simple job queue for crawling novel sources using Playwright + Cheerio.

Features:

- Concurrency control
- Retry with delay
- Pause/Resume/Cancel
- EventEmitter hooks for UI integration (`enqueue`, `start`, `success`, `retry`, `failed`, `done`)

Important: Playwright is used here for robust fetching of JS-rendered pages; when packaging with Tauri, evaluate using a lightweight fetch fallback for performance.

# Crawler

This folder will contain the Playwright/Cheerio based crawler and queue implementation.
