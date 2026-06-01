import React from 'react';
import Header from '../components/Header';
import CrawlerPanel from '../components/CrawlerPanel';
import GlossaryPanel from '../components/GlossaryPanel';
import TTSControls from '../components/TTSControls';
import ReaderPanel from '../components/ReaderPanel';
import LibraryPanel from '../components/LibraryPanel';
import SettingsPanel from '../components/SettingsPanel';

export default function Home() {
  const [mode, setMode] = React.useState<'reader' | 'advanced'>('reader');

  return (
    <div>
      <Header mode={mode} onModeChange={setMode} />
      <main className="mx-auto max-w-7xl px-4 py-4 lg:px-6">
        {mode === 'reader' ? (
          <section className="grid min-h-[calc(100vh-112px)] gap-4 lg:grid-cols-[360px_1fr]">
            <aside className="order-2 lg:order-1">
              <LibraryPanel />
            </aside>
            <section className="order-1 min-w-0 lg:order-2">
              <ReaderPanel />
            </section>
          </section>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
            <section>
              <CrawlerPanel />
            </section>
            <aside className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <SettingsPanel />
              <TTSControls />
              <GlossaryPanel />
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
