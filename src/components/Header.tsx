import React from 'react';

export type AppMode = 'library' | 'reading' | 'admin';

export default function Header({
  mode,
  onModeChange,
}: {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--app-bg-soft)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[var(--app-fg)]">
            Novel TTS
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Library, immersive reading, crawler admin
          </p>
        </div>
        <nav className="segmented-control" aria-label="App mode">
          <button
            className={mode === 'library' ? 'active' : ''}
            onClick={() => onModeChange('library')}
          >
            Library
          </button>
          <button
            className={mode === 'reading' ? 'active' : ''}
            onClick={() => onModeChange('reading')}
          >
            Reading
          </button>
          <button
            className={mode === 'admin' ? 'active' : ''}
            onClick={() => onModeChange('admin')}
          >
            Admin
          </button>
        </nav>
      </div>
    </header>
  );
}
