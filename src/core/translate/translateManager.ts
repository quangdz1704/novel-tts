import type {
  TranslatorProvider,
  TranslatorParams,
} from './TranslatorProvider';
import { getCached, setCached } from './cache';

export type ManagerOptions = {
  retryCount?: number;
  timeoutMs?: number;
  fallbackEnabled?: boolean;
};

export class TranslateManager {
  providers: TranslatorProvider[] = [];
  options: ManagerOptions;

  constructor(
    providers: TranslatorProvider[] = [],
    options: ManagerOptions = {},
  ) {
    this.providers = providers;
    this.options = {
      retryCount: 2,
      timeoutMs: 30_000,
      fallbackEnabled: true,
      ...options,
    };
  }

  setProviders(list: TranslatorProvider[]) {
    this.providers = list;
  }

  async translate(text: string, params: Omit<TranslatorParams, 'text'> = {}) {
    const cacheKey = `sha1:${text.slice(0, 200)}`;
    const cached = await getCached(cacheKey);
    if (cached) return cached;

    let lastErr: any = null;

    for (const provider of this.providers) {
      for (
        let attempt = 0;
        attempt <= (this.options.retryCount || 0);
        attempt++
      ) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(
            () => controller.abort(),
            this.options.timeoutMs,
          );
          const result = await provider.translate({ text, ...params });
          clearTimeout(timeout);
          await setCached(cacheKey, result);
          return result;
        } catch (e) {
          lastErr = e;
          // continue retrying
          if (attempt < (this.options.retryCount || 0)) continue;
          break;
        }
      }
      // try next provider if fallback enabled
      if (!this.options.fallbackEnabled) break;
    }

    throw lastErr || new Error('No translators available');
  }
}
