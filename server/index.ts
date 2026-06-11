import { buildApp } from './app';
import { config } from './config';
import { closeBrowser } from './crawler/fetcher';
import { startWorker, stopWorker } from './crawler/worker';
import { pool } from './db/client';
import { migrate } from './db/schema';

async function main() {
  await migrate();
  const app = await buildApp();
  startWorker();

  const shutdown = async () => {
    stopWorker();
    await app.close();
    await closeBrowser();
    await pool.end();
  };

  process.on('SIGINT', () => void shutdown().finally(() => process.exit(0)));
  process.on('SIGTERM', () => void shutdown().finally(() => process.exit(0)));

  await app.listen({
    host: '127.0.0.1',
    port: config.port,
  });
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
