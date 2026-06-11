import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app';

describe('Fastify API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports health without binding a port', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it('validates crawl request bodies', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/crawl/jobs',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain("must have required property 'url'");
  });

  it('rejects hosts that only end with the WikiCV name', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/crawl/jobs',
      payload: { url: 'https://evilwikicv.net/truyen/test' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: 'Advanced crawl currently supports WikiCV',
    });
  });

  it('validates retry options before touching the database', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/crawl/jobs',
      payload: {
        url: 'https://wikicv.net/truyen/test',
        retryLimit: 11,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('must be <= 10');
  });
});
