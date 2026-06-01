# Translator subsystem

This module contains the translator provider abstraction, provider stubs, a manager that handles provider priority, retries, and caching, and a simple cache implementation that prefers filesystem storage with a localStorage fallback.

Files:

- `TranslatorProvider.ts` — provider interface
- `providers/` — provider implementations (stubs)
- `translateManager.ts` — orchestration + retries + fallback
- `cache.ts` — simple caching layer
