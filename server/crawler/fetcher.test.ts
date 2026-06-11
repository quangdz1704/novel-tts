import { describe, expect, it } from 'vitest';
import { CrawlFetchError, getFetchRetryDelay } from './fetcher';

describe('crawler fetch backoff', () => {
  it('uses the longer server cooldown', () => {
    const error = new CrawlFetchError('HTTP 429', {
      status: 429,
      retryAfterMs: 60_000,
    });

    expect(getFetchRetryDelay(error, 2_000)).toBe(60_000);
  });

  it('keeps exponential backoff when it is already longer', () => {
    const error = new CrawlFetchError('HTTP 503', {
      status: 503,
      retryAfterMs: 1_000,
    });

    expect(getFetchRetryDelay(error, 8_000)).toBe(8_000);
  });
});
