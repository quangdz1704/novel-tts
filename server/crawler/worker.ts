import {
  claimCrawlJob,
  recoverInterruptedJobs,
} from '../db/repository';
import { crawlWikiCv } from './wikicv';

let running = false;

export function startWorker() {
  if (running) return;
  running = true;

  void (async () => {
    await recoverInterruptedJobs();
    while (running) {
      const job = await claimCrawlJob().catch((error) => {
        console.error('Failed to claim crawl job:', error);
        return undefined;
      });

      if (!job) {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        continue;
      }

      if (job.source_key === 'wikicv') {
        await crawlWikiCv(job);
      }
    }
  })();
}

export function stopWorker() {
  running = false;
}
