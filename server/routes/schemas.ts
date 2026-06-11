export type CrawlBody = {
  url: string;
  maxChapters?: number;
  retryLimit?: number;
  retryBackoffMs?: number;
  skipFailed?: boolean;
  retryFailedAtEnd?: boolean;
};

export type IdParams = {
  id: string;
};

export type ResumeBody = Omit<CrawlBody, 'url'>;
export type ReadingProgressBody = {
  chapterId?: string;
  position: Record<string, unknown>;
};

const crawlOptionProperties = {
  maxChapters: { type: 'integer', minimum: 0 },
  retryLimit: { type: 'integer', minimum: 0, maximum: 10 },
  retryBackoffMs: { type: 'integer', minimum: 250, maximum: 60_000 },
  skipFailed: { type: 'boolean' },
  retryFailedAtEnd: { type: 'boolean' },
} as const;

export const crawlBodySchema = {
  type: 'object',
  required: ['url'],
  additionalProperties: false,
  properties: {
    url: { type: 'string', minLength: 1, maxLength: 2_048 },
    ...crawlOptionProperties,
  },
} as const;

export const resumeBodySchema = {
  type: 'object',
  additionalProperties: false,
  properties: crawlOptionProperties,
} as const;

export const idParamsSchema = {
  type: 'object',
  required: ['id'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', minLength: 1 },
  },
} as const;

export const readingProgressBodySchema = {
  type: 'object',
  required: ['position'],
  additionalProperties: false,
  properties: {
    chapterId: { type: 'string', minLength: 1 },
    position: { type: 'object', additionalProperties: true },
  },
} as const;
