import type { FastifyInstance } from 'fastify';
import {
  createOrResumeCrawlJob,
  getCrawlJob,
  listJobItems,
  requestCancel,
  resumeJob,
  serializeJob,
  serializeJobItem,
} from '../db/repository';
import { previewWikiCv } from '../crawler/wikicv';
import {
  crawlBodySchema,
  idParamsSchema,
  resumeBodySchema,
  type CrawlBody,
  type IdParams,
  type ResumeBody,
} from './schemas';

function assertWikiCvUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw Object.assign(new Error('Invalid URL'), { statusCode: 400 });
  }
  if (
    url.hostname !== 'wikicv.net' &&
    !url.hostname.endsWith('.wikicv.net')
  ) {
    throw Object.assign(
      new Error('Advanced crawl currently supports WikiCV'),
      { statusCode: 400 },
    );
  }
}

export async function registerCrawlRoutes(app: FastifyInstance) {
  app.post<{ Body: CrawlBody }>(
    '/api/crawl/preview',
    { schema: { body: crawlBodySchema } },
    async (request) => {
      assertWikiCvUrl(request.body.url);
      return previewWikiCv(request.body.url, 3);
    },
  );

  app.post<{ Body: CrawlBody }>(
    '/api/crawl/jobs',
    { schema: { body: crawlBodySchema } },
    async (request, reply) => {
      assertWikiCvUrl(request.body.url);
      const job = await createOrResumeCrawlJob(request.body.url, {
        maxChapters: Math.max(0, request.body.maxChapters || 0),
        retryLimit: request.body.retryLimit ?? 3,
        retryBackoffMs: request.body.retryBackoffMs ?? 2_000,
        skipFailed: request.body.skipFailed ?? false,
        retryFailedAtEnd: request.body.retryFailedAtEnd ?? true,
      });
      return reply.status(202).send(serializeJob(job));
    },
  );

  app.get<{ Params: IdParams }>(
    '/api/crawl/jobs/:id/events',
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      reply.hijack();
      const response = reply.raw;
      response.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
        'access-control-allow-origin': '*',
      });

      let closed = false;
      request.raw.on('close', () => {
        closed = true;
      });

      while (!closed) {
        const job = await getCrawlJob(request.params.id);
        if (!job) {
          response.write(
            `event: error\ndata: ${JSON.stringify({ error: 'Job not found' })}\n\n`,
          );
          response.end();
          return;
        }

        response.write(`data: ${JSON.stringify(serializeJob(job))}\n\n`);
        if (
          [
            'done',
            'done_with_errors',
            'paused',
            'failed',
            'cancelled',
          ].includes(job.state)
        ) {
          response.end();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    },
  );

  app.get<{ Params: IdParams }>(
    '/api/crawl/jobs/:id',
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      const job = await getCrawlJob(request.params.id);
      if (!job) return reply.status(404).send({ error: 'Job not found' });
      return serializeJob(job);
    },
  );

  app.get<{ Params: IdParams }>(
    '/api/crawl/jobs/:id/items',
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      const job = await getCrawlJob(request.params.id);
      if (!job) return reply.status(404).send({ error: 'Job not found' });
      return (await listJobItems(request.params.id)).map(serializeJobItem);
    },
  );

  app.post<{ Params: IdParams }>(
    '/api/crawl/jobs/:id/cancel',
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      const job = await getCrawlJob(request.params.id);
      if (!job) return reply.status(404).send({ error: 'Job not found' });
      await requestCancel(request.params.id);
      return reply.status(202).send({ ok: true });
    },
  );

  app.post<{ Params: IdParams; Body: ResumeBody }>(
    '/api/crawl/jobs/:id/resume',
    {
      schema: {
        params: idParamsSchema,
        body: resumeBodySchema,
      },
    },
    async (request, reply) => {
      const job = await resumeJob(request.params.id, request.body);
      if (!job) {
        return reply
          .status(409)
          .send({ error: 'Job is not resumable or does not exist' });
      }
      return reply.status(202).send(serializeJob(job));
    },
  );
}
