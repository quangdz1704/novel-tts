import { chromium, type Browser } from 'playwright';

let browser: Browser | null = null;

export async function ensureBrowser() {
  if (!browser) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

export async function fetchWithPlaywright(
  url: string,
  opts: { timeoutMs?: number } = {},
) {
  const b = await ensureBrowser();
  const context = await b.newContext();
  const page = await context.newPage();
  try {
    await page.goto(url, {
      timeout: opts.timeoutMs ?? 30_000,
      waitUntil: 'domcontentloaded',
    });
    const content = await page.content();
    await page.close();
    await context.close();
    return { ok: true, status: 200, content };
  } catch (err: any) {
    try {
      await page.close();
    } catch {}
    try {
      await context.close();
    } catch {}
    return { ok: false, status: err?.message || 'error', content: '' };
  }
}
