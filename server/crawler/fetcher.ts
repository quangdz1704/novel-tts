import dns from 'node:dns/promises';
import { access } from 'node:fs/promises';
import net from 'node:net';
import { chromium, type Browser } from 'playwright';
import { config } from '../config';

let browser: Browser | undefined;
const nextRequestAtByHost = new Map<string, number>();
const hostQueues = new Map<string, Promise<void>>();

export class CrawlFetchError extends Error {
  status?: number;
  retryAfterMs?: number;

  constructor(
    message: string,
    options: { status?: number; retryAfterMs?: number; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'CrawlFetchError';
    this.status = options.status;
    this.retryAfterMs = options.retryAfterMs;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomJitter(maxMs: number) {
  return maxMs > 0 ? Math.floor(Math.random() * (maxMs + 1)) : 0;
}

function parseRetryAfter(value: string | null) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

function cooldownForStatus(status: number, retryAfter?: string | null) {
  const headerDelay = parseRetryAfter(retryAfter || null);
  if (headerDelay != null) return headerDelay;
  if (status === 403) return config.forbiddenCooldownMs;
  if (status === 429 || status === 503) return config.rateLimitCooldownMs;
  return undefined;
}

async function waitForHostSlot(rawUrl: string) {
  const host = new URL(rawUrl).hostname.toLowerCase();
  const previous = hostQueues.get(host) || Promise.resolve();
  const current = previous
    .catch(() => {})
    .then(async () => {
      const waitMs = Math.max(
        0,
        (nextRequestAtByHost.get(host) || 0) - Date.now(),
      );
      if (waitMs > 0) await delay(waitMs);
      nextRequestAtByHost.set(
        host,
        Date.now() + config.minDelayMs + randomJitter(config.delayJitterMs),
      );
    });
  hostQueues.set(host, current);
  try {
    await current;
  } finally {
    if (hostQueues.get(host) === current) hostQueues.delete(host);
  }
}

function applyHostCooldown(rawUrl: string, cooldownMs: number) {
  const host = new URL(rawUrl).hostname.toLowerCase();
  nextRequestAtByHost.set(
    host,
    Math.max(nextRequestAtByHost.get(host) || 0, Date.now() + cooldownMs),
  );
}

export function getFetchRetryDelay(error: unknown, fallbackMs: number) {
  if (error instanceof CrawlFetchError && error.retryAfterMs != null) {
    return Math.max(fallbackMs, error.retryAfterMs);
  }
  return fallbackMs;
}

async function ensureBrowser() {
  if (browser) return browser;

  try {
    await access(chromium.executablePath());
    browser = await chromium.launch({ headless: true });
    return browser;
  } catch {}

  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    return browser;
  } catch {
    throw new Error(
      'No Playwright Chromium or system Chrome found. Run: npm run playwright:install',
    );
  }
}

function isPrivateIp(address: string) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 0
    );
  }

  const normalized = address.toLowerCase();
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  );
}

async function validateUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http and https URLs are allowed');
  }
  if (!config.allowedHosts.has(url.hostname.toLowerCase())) {
    throw new Error(`Host is not allowed: ${url.hostname}`);
  }

  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error('URL resolves to a private or invalid address');
  }
  return url;
}

async function fetchHttpHtml(rawUrl: string) {
  let current = await validateUrl(rawUrl);

  for (let redirect = 0; redirect <= 5; redirect += 1) {
    await waitForHostSlot(current.href);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.fetchTimeoutMs);
    try {
      const response = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'user-agent': 'NovelTTS/0.1 personal crawler',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new Error(`Redirect ${response.status} has no location`);
        current = await validateUrl(new URL(location, current).href);
        continue;
      }
      if (!response.ok) {
        const cooldownMs = cooldownForStatus(
          response.status,
          response.headers.get('retry-after'),
        );
        if (cooldownMs != null) applyHostCooldown(current.href, cooldownMs);
        throw new CrawlFetchError(`HTTP ${response.status}`, {
          status: response.status,
          retryAfterMs: cooldownMs,
        });
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        throw new Error(`Unexpected content type: ${contentType || 'unknown'}`);
      }

      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > config.maxResponseBytes) {
        throw new Error('Response is too large');
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > config.maxResponseBytes) {
        throw new Error('Response is too large');
      }
      return new TextDecoder().decode(bytes);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error('Too many redirects');
}

async function fetchPlaywrightHtml(rawUrl: string) {
  const url = await validateUrl(rawUrl);
  await waitForHostSlot(url.href);
  const activeBrowser = await ensureBrowser();
  const context = await activeBrowser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(url.href, {
      waitUntil: 'domcontentloaded',
      timeout: config.fetchTimeoutMs,
    });
    return await page.content();
  } finally {
    await context.close();
  }
}

export async function fetchHtml(
  url: string,
  isExpectedHtml: (html: string) => boolean,
) {
  let httpError: unknown;
  try {
    const html = await fetchHttpHtml(url);
    if (isExpectedHtml(html)) return { html, transport: 'http' as const };
    httpError = new Error('HTTP response did not contain expected content');
  } catch (error) {
    httpError = error;
  }

  if (
    httpError instanceof CrawlFetchError &&
    [403, 429, 503].includes(httpError.status || 0)
  ) {
    throw httpError;
  }

  try {
    const html = await fetchPlaywrightHtml(url);
    if (!isExpectedHtml(html)) {
      throw new Error('Browser response did not contain expected content');
    }
    return { html, transport: 'playwright' as const };
  } catch (browserError) {
    throw new CrawlFetchError(
      `HTTP fetch failed (${String(httpError)}); Playwright failed (${String(browserError)})`,
      { cause: browserError },
    );
  }
}

export async function closeBrowser() {
  await browser?.close();
  browser = undefined;
}
