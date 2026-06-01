import React from 'react';
import Header from '../components/Header';
import CrawlerPanel from '../components/CrawlerPanel';
import GlossaryPanel from '../components/GlossaryPanel';
import TTSControls from '../components/TTSControls';
import ReaderPanel from '../components/ReaderPanel';
import LibraryPanel from '../components/LibraryPanel';
import SettingsPanel from '../components/SettingsPanel';

export default function Home() {
  return (
    <div className="container mx-auto p-6">
      <Header />
      <main className="mt-6">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 rounded-2xl bg-white/5 shadow-lg">
            Welcome to Novel TTS — scaffolded.
          </div>
          <div className="col-span-1 md:col-span-2 space-y-4">
            <CrawlerPanel />
            <GlossaryPanel />
            <TTSControls />
            <ReaderPanel />
            <LibraryPanel />
            <SettingsPanel />
          </div>
        </section>
      </main>
    </div>
  );
}
