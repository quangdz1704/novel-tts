import { novelbinAdapter } from './novelbin';
import { truyenfullAdapter } from './truyenfull';
import { wikicvAdapter } from './wikicv';
import type { SourceAdapter } from './SourceAdapter';

export const adapters: SourceAdapter[] = [
  wikicvAdapter,
  novelbinAdapter,
  truyenfullAdapter,
];

export function findAdapter(url: string): SourceAdapter | undefined {
  return adapters.find((a) => a.match(url));
}

export function findAdapterById(id?: string): SourceAdapter | undefined {
  if (!id) return undefined;
  return adapters.find((adapter) => adapter.id === id);
}

export function getSourceInfo(url: string, adapter?: SourceAdapter) {
  try {
    const parsed = new URL(url);
    return {
      source: adapter?.id,
      sourceLabel: adapter?.label,
      sourceHost: parsed.hostname,
      sourceUrl: url,
    };
  } catch (e) {
    return {
      source: adapter?.id,
      sourceLabel: adapter?.label,
      sourceUrl: url,
    };
  }
}
