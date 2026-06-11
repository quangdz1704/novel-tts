import type { FastifyInstance } from 'fastify';
import {
  getChapter,
  getNovel,
  getReadingProgress,
  listChapters,
  listNovels,
  saveReadingProgress,
} from '../db/repository';
import {
  idParamsSchema,
  readingProgressBodySchema,
  type IdParams,
  type ReadingProgressBody,
} from './schemas';

export async function registerLibraryRoutes(app: FastifyInstance) {
  app.get('/api/novels', async () => listNovels());

  app.get<{ Params: IdParams }>(
    '/api/novels/:id/chapters',
    { schema: { params: idParamsSchema } },
    async (request) => listChapters(request.params.id),
  );

  app.get<{ Params: IdParams }>(
    '/api/novels/:id/progress',
    { schema: { params: idParamsSchema } },
    async (request, reply) => {
      const progress = await getReadingProgress(request.params.id);
      if (!progress) {
        return reply.status(404).send({ error: 'Reading progress not found' });
      }
      return progress;
    },
  );

  app.put<{ Params: IdParams; Body: ReadingProgressBody }>(
    '/api/novels/:id/progress',
    {
      schema: {
        params: idParamsSchema,
        body: readingProgressBodySchema,
      },
    },
    async (request, reply) => {
      const novel = await getNovel(request.params.id);
      if (!novel) return reply.status(404).send({ error: 'Novel not found' });
      if (request.body.chapterId) {
        const chapter = await getChapter(request.body.chapterId);
        if (!chapter || String(chapter.novel_id) !== request.params.id) {
          return reply.status(400).send({ error: 'Chapter does not belong to novel' });
        }
      }
      return saveReadingProgress(request.params.id, request.body);
    },
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
