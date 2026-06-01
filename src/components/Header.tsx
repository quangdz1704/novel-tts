import React from 'react';

export type AppMode = 'reader' | 'advanced';

export default function Header({
  mode,
  onModeChange,
}: {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-950">
            Novel TTS
          </h1>
          <p className="text-sm text-slate-500">
            Local-first reader, crawler and TTS
          </p>
        </div>
        <nav className="segmented-control" aria-label="App mode">
          <button
            className={mode === 'reader' ? 'active' : ''}
            onClick={() => onModeChange('reader')}
          >
            Reader
          </button>
          <button
            className={mode === 'advanced' ? 'active' : ''}
            onClick={() => onModeChange('advanced')}
          >
            Advanced
          </button>
        </nav>
      </div>
    </header>
  );
}
