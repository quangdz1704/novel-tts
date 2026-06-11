import 'dotenv/config';

const DEFAULT_ALLOWED_HOSTS = [
  'wikicv.net',
  'www.wikicv.net',
  'novelbin.me',
  'www.novelbin.me',
  'truyenfull.vision',
  'www.truyenfull.vision',
];

function numberFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const config = {
  port: numberFromEnv('API_PORT', 8787),
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@127.0.0.1:5432/novel_tts',
  allowedHosts: new Set(
    (process.env.CRAWL_ALLOWED_HOSTS || DEFAULT_ALLOWED_HOSTS.join(','))
      .split(',')
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  ),
  fetchTimeoutMs: numberFromEnv('CRAWL_TIMEOUT_MS', 20_000),
  maxResponseBytes: numberFromEnv('CRAWL_MAX_RESPONSE_BYTES', 5_000_000),
  maxChapters: numberFromEnv('CRAWL_MAX_CHAPTERS', 3_000),
  minDelayMs: numberFromEnv('CRAWL_MIN_DELAY_MS', 1_500),
  delayJitterMs: numberFromEnv('CRAWL_DELAY_JITTER_MS', 1_500),
  rateLimitCooldownMs: numberFromEnv(
    'CRAWL_RATE_LIMIT_COOLDOWN_MS',
    60_000,
  ),
  forbiddenCooldownMs: numberFromEnv(
    'CRAWL_FORBIDDEN_COOLDOWN_MS',
    5 * 60_000,
  ),
};
