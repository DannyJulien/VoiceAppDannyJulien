import { z } from 'zod';

export const researchConfidenceSchema = z.enum(['high', 'medium', 'low']);
export const researchSourceTypeSchema = z.enum([
  'government',
  'statistics',
  'eu_institution',
  'regulation',
  'university',
  'research',
  'news',
  'company',
  'documentation',
  'other',
]);

export const researchSourceSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(600),
  publisher: z.string().trim().min(1).max(280).nullable(),
  url: z.url().startsWith('https://'),
  publishedAt: z.string().datetime({ offset: true }).nullable(),
  accessedAt: z.string().datetime({ offset: true }),
  sourceType: researchSourceTypeSchema,
  trustTier: z.number().int().min(1).max(5),
});

export const researchFindingSchema = z.object({
  id: z.string().uuid(),
  claim: z.string().trim().min(1).max(2_000),
  explanation: z.string().trim().max(4_000).nullable(),
  confidence: researchConfidenceSchema,
  sourceIds: z.array(z.string().uuid()).min(1),
});

export const researchResultSchema = z
  .object({
    id: z.string().uuid(),
    topic: z.string().trim().min(1).max(280),
    directAnswer: z.string().trim().min(1).max(8_000),
    executiveSummary: z.string().trim().min(1).max(8_000),
    shareMessage: z.string().trim().min(1).max(8_000),
    talkingPoints: z.array(z.string().trim().min(1).max(1_000)).max(8),
    counterpoints: z.array(z.string().trim().min(1).max(2_000)).max(6),
    overallConfidence: researchConfidenceSchema,
    researchedAt: z.string().datetime({ offset: true }),
    keyFindings: z.array(researchFindingSchema).min(1).max(8),
    sources: z.array(researchSourceSchema).min(1).max(20),
  })
  .superRefine((result, context) => {
    const sourceIds = new Set(result.sources.map((source) => source.id));
    result.keyFindings.forEach((finding, findingIndex) => {
      finding.sourceIds.forEach((sourceId, sourceIndex) => {
        if (!sourceIds.has(sourceId)) {
          context.addIssue({
            code: 'custom',
            message: 'Each finding must reference a source in this research result.',
            path: ['keyFindings', findingIndex, 'sourceIds', sourceIndex],
          });
        }
      });
    });
  });

export const startResearchResponseSchema = z.object({
  researchSessionId: z.string().uuid(),
});

export type ResearchResult = z.infer<typeof researchResultSchema>;
