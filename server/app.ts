import cors from '@fastify/cors';
import Fastify, {
  type FastifyError,
  type FastifyInstance,
} from 'fastify';
import { registerCrawlRoutes } from './routes/crawl';
import { registerLibraryRoutes } from './routes/library';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
    bodyLimit: 100_000,
  });

  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  });

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) app.log.error(error);
    void reply.status(statusCode).send({ error: error.message });
  });

  app.get('/api/health', async () => ({ ok: true }));
  await registerCrawlRoutes(app);
  await registerLibraryRoutes(app);

  return app;
}
