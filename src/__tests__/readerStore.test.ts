import { describe, it, expect, vi } from 'vitest';

// Mock Tauri APIs used by fsAdapter so tests run in Node environment
vi.mock('@tauri-apps/api/fs', () => ({
  writeFile: async () => {},
  readTextFile: async () => '',
  createDir: async () => {},
  readDir: async () => [],
}));
vi.mock('@tauri-apps/api/path', () => ({
  appDir: async () => '/tmp',
}));

import { useReaderStore } from '../core/reader/readerStore';

describe('readerStore basic', () => {
  it('exposes loadChapter and saveProgress', () => {
    const s = useReaderStore.getState();
    expect(typeof s.loadChapter).toBe('function');
    expect(typeof s.saveProgress).toBe('function');
  });
});
