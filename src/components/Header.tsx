import React from 'react';

export default function Header() {
  return (
    <header className="flex items-center justify-between">
      <h1 className="text-2xl font-semibold">Novel TTS</h1>
      <nav>
        <button className="px-3 py-1 rounded bg-white/6">Library</button>
      </nav>
    </header>
  );
}
