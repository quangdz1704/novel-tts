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
