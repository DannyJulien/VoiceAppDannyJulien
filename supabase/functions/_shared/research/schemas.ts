import { z } from 'https://esm.sh/zod@4.4.3';

export const researchRequestSchema = z.object({
  actionId: z.string().uuid().nullable().optional(),
  captureId: z.string().uuid(),
  topic: z.string().trim().min(1).max(280),
  researchGoal: z
    .enum([
      'answer_question',
      'support_claim',
      'challenge_claim',
      'meeting_preparation',
      'decision_support',
      'general_background',
    ])
    .nullable(),
  researchFreshness: z.enum(['current', 'recent', 'historical', 'not_time_sensitive']),
});

export const researchSynthesisSchema = z.object({
  topic: z.string().trim().min(1).max(280),
  directAnswer: z.string().trim().min(1).max(8_000),
  executiveSummary: z.string().trim().min(1).max(8_000),
  keyFindings: z
    .array(
      z.object({
        claim: z.string().trim().min(1).max(2_000),
        explanation: z.string().trim().max(4_000),
        sourceUrls: z.array(z.url()).min(1).max(4),
        confidence: z.enum(['high', 'medium', 'low']),
      }),
    )
    .min(1)
    .max(8),
  talkingPoints: z.array(z.string().trim().min(1).max(1_000)).max(8),
  counterpoints: z.array(z.string().trim().min(1).max(2_000)).max(6),
  shareMessage: z.string().trim().min(1).max(8_000),
  overallConfidence: z.enum(['high', 'medium', 'low']),
});

export type ResearchSynthesis = z.infer<typeof researchSynthesisSchema>;

export const researchSynthesisJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'topic',
    'directAnswer',
    'executiveSummary',
    'keyFindings',
    'talkingPoints',
    'counterpoints',
    'shareMessage',
    'overallConfidence',
  ],
  properties: {
    topic: { type: 'string' },
    directAnswer: { type: 'string' },
    executiveSummary: { type: 'string' },
    keyFindings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['claim', 'explanation', 'sourceUrls', 'confidence'],
        properties: {
          claim: { type: 'string' },
          explanation: { type: 'string' },
          sourceUrls: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
    talkingPoints: { type: 'array', items: { type: 'string' } },
    counterpoints: { type: 'array', items: { type: 'string' } },
    shareMessage: { type: 'string' },
    overallConfidence: { type: 'string', enum: ['high', 'medium', 'low'] },
  },
};
