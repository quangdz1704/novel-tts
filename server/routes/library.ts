import type { FastifyInstance } from 'fastify';
import {
  getChapter,
  getNovel,
  listChapters,
  listNovels,
} from '../db/repository';
import { idParamsSchema, type IdParams } from './schemas';

export async function registerLibraryRoutes(app: FastifyInstance) {
  app.get('/api/novels', async () => listNovels());

  app.get<{ Params: IdParams }>(
    '/api/novels/:id/chapters',
    { schema: { params: idParamsSchema } },
    async (request) => listChapters(request.params.id),
  );

  app.get<{ Params: IdParams }>(
    '/api/novels/:id',
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      const novel = await getNovel(request.params.id);
      if (!novel) return reply.status(404).send({ error: 'Novel not found' });
      return novel;
    },
  );

  app.get<{ Params: IdParams }>(
    '/api/chapters/:id',
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      const chapter = await getChapter(request.params.id);
      if (!chapter) return reply.status(404).send({ error: 'Chapter not found' });
      return chapter;
    },
  );
}

