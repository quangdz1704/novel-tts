# Glossary System

Glossary JSON files live under `/src/core/glossary/`.

Each glossary entry should be an object with:

- `find`: string or regex
- `replace`: string
- `protected`: boolean (optional)
- `regex`: boolean (optional)

The `GlossaryManager` loads global/style/novel glossaries and exposes `applyGlossary(text, options)` for replacements.
