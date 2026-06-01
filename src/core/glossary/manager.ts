import type { GlossaryEntry } from './index';
import { globalGlossaries, styleGlossaries } from './index';

export type GlossarySource = 'novel' | 'style' | 'global';

export class GlossaryManager {
  novelGlossaries: Record<string, GlossaryEntry[]> = {};

  getGlossariesFor(novelId?: string, style?: string) {
    const list: GlossaryEntry[] = [];
    // novel-specific
    if (novelId && this.novelGlossaries[novelId]) {
      list.push(...this.novelGlossaries[novelId]);
    }
    // style
    if (style && styleGlossaries[style]) list.push(...styleGlossaries[style]);
    // global
    for (const k of Object.keys(globalGlossaries))
      list.push(...(globalGlossaries as any)[k]);
    return list;
  }

  addNovelGlossary(novelId: string, entries: GlossaryEntry[]) {
    this.novelGlossaries[novelId] = entries;
  }

  applyGlossary(
    text: string,
    opts: { novelId?: string; style?: string; skipProtected?: boolean } = {},
  ) {
    const entries = this.getGlossariesFor(opts.novelId, opts.style);
    let res = text;
    for (const e of entries) {
      if (opts.skipProtected && e.protected) continue;
      try {
        if (e.regex) {
          const re = new RegExp(e.find, 'g');
          res = res.replace(re, e.replace);
        } else {
          // simple string replace
          res = res.split(e.find).join(e.replace);
        }
      } catch (err) {
        // skip malformed regex
      }
    }
    return res;
  }
}

export const glossaryManager = new GlossaryManager();
