import { z } from 'zod';

import type { ActionCategory, ActionType } from '@/types/database';

export const actionTypeSchema = z.enum(['note', 'task', 'reminder', 'message']);
export const actionIntentSchema = z.enum([
  'note',
  'task',
  'reminder',
  'message',
  'question',
  'statement',
  'research_request',
]);
export const researchGoalSchema = z
  .enum([
    'answer_question',
    'support_claim',
    'challenge_claim',
    'meeting_preparation',
    'decision_support',
    'general_background',
  ])
  .nullable()
  .default(null);
export const researchFreshnessSchema = z.enum([
  'current',
  'recent',
  'historical',
  'not_time_sensitive',
]);
export const actionCategorySchema = z.enum(['inbox', 'work', 'personal', 'meeting', 'idea']);

export const understoodActionSchema = z.object({
  intent: actionIntentSchema,
  title: z.string().trim().min(1).max(280),
  summary: z.string().trim().max(2_000),
  topic: z.string().trim().min(1).max(280).nullable().default(null),
  couldBenefitFromResearch: z.boolean().default(false),
  researchReason: z.string().trim().max(500).nullable().default(null),
  researchGoal: researchGoalSchema,
  researchFreshness: researchFreshnessSchema.default('not_time_sensitive'),
  people: z.array(
    z.object({
      name: z.string().trim().min(1).max(160),
      role: z.enum(['recipient', 'mentioned']),
    }),
  ),
  scheduledAt: z.string().datetime({ offset: true }).nullable(),
  messageDraft: z.string().trim().max(5_000).nullable(),
  confidence: z.number().min(0).max(1),
  requiresClarification: z.boolean(),
  clarificationQuestion: z.string().trim().max(500).nullable(),
  suggestedCategory: actionCategorySchema.nullable().default(null),
  suggestedProjectName: z.string().trim().min(1).max(80).nullable().default(null),
});

export type UnderstoodAction = z.infer<typeof understoodActionSchema>;
export type ActionIntent = z.infer<typeof actionIntentSchema>;
export type ResearchGoal = z.infer<typeof researchGoalSchema>;
export type ResearchFreshness = z.infer<typeof researchFreshnessSchema>;
export type SuggestedCategory = ActionCategory | null;

export function actionTypeForIntent(intent: ActionIntent): ActionType {
  const parsed = actionTypeSchema.safeParse(intent);
  return parsed.success ? parsed.data : 'note';
}
