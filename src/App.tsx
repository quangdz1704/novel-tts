import React from 'react';
import Home from './pages/Home';
import { useSettingsStore } from './stores/settingsStore';

export default function App() {
  const loadSettings = useSettingsStore((s) => s.load);

  React.useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)]">
      <Home />
    </div>
  );
}
