import { describe, it, expect } from 'vitest';

import { useReaderStore } from '../core/reader/readerStore';

describe('readerStore basic', () => {
  it('exposes loadChapter and saveProgress', () => {
    const s = useReaderStore.getState();
    expect(typeof s.loadChapter).toBe('function');
    expect(typeof s.saveProgress).toBe('function');
  });
});
