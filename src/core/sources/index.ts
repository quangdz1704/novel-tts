import { novelbinAdapter } from './novelbin';
import { truyenfullAdapter } from './truyenfull';
import type { SourceAdapter } from './SourceAdapter';

export const adapters: SourceAdapter[] = [novelbinAdapter, truyenfullAdapter];

export function findAdapter(url: string): SourceAdapter | undefined {
  return adapters.find((a) => a.match(url));
}
