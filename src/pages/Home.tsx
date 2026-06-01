import React from 'react';
import Header from '../components/Header';
import CrawlerPanel from '../components/CrawlerPanel';
import GlossaryPanel from '../components/GlossaryPanel';
import TTSControls from '../components/TTSControls';
import ReaderPanel from '../components/ReaderPanel';
import LibraryPanel from '../components/LibraryPanel';
import SettingsPanel from '../components/SettingsPanel';

export default function Home() {
  const [mode, setMode] = React.useState<'library' | 'reading' | 'admin'>(
    'library',
  );
  const [adminTab, setAdminTab] = React.useState<'crawl' | 'tools'>('crawl');

  return (
    <div>
      <Header mode={mode} onModeChange={setMode} />
      <main className="mx-auto max-w-7xl px-4 py-5 lg:px-6">
        {mode === 'library' && (
          <LibraryPanel onRead={() => setMode('reading')} />
        )}

        {mode === 'reading' && (
          <ReaderPanel onBackToLibrary={() => setMode('library')} />
        )}

        {mode === 'admin' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-3 shadow-xl shadow-black/10 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="panel-kicker">Admin workspace</p>
                <h2 className="panel-title">Crawler and tools</h2>
              </div>
              <div className="segmented-control w-full sm:w-auto">
                <button
                  className={adminTab === 'crawl' ? 'active' : ''}
                  onClick={() => setAdminTab('crawl')}
                >
                  Crawl
                </button>
                <button
                  className={adminTab === 'tools' ? 'active' : ''}
                  onClick={() => setAdminTab('tools')}
                >
                  Tools
                </button>
              </div>
            </div>

            {adminTab === 'crawl' ? (
              <CrawlerPanel />
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                <SettingsPanel />
                <TTSControls />
                <GlossaryPanel />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
