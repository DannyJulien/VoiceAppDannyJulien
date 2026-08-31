import { describe, expect, it } from '@jest/globals';

import type { UnderstoodAction } from '@/features/actions/action-schema';
import {
  CONFIDENCE_HIGH,
  CONFIDENCE_LOW,
  decideFiling,
  projectIdForFiling,
  type FilingContext,
} from '@/features/actions/filing-gate';

function capture(overrides: Partial<UnderstoodAction> = {}): UnderstoodAction {
  return {
    intent: 'reminder',
    title: 'Call the dentist',
    summary: 'Call the dentist on Friday.',
    topic: null,
    couldBenefitFromResearch: false,
    researchReason: null,
    researchGoal: null,
    researchFreshness: 'not_time_sensitive',
    people: [],
    scheduledAt: '2026-09-04T09:00:00+02:00',
    messageDraft: null,
    confidence: 0.9,
    requiresClarification: false,
    clarificationQuestion: null,
    suggestedCategory: 'personal',
    suggestedProjectName: null,
    checklistItems: [],
    ...overrides,
  };
}

const context: FilingContext = {
  autoFileEnabled: true,
  projects: [{ id: 'p1', name: 'Voice App' }],
  contacts: [{ id: 'c1', name: 'Julien' }],
};

describe('confidence gate', () => {
  it('files a clear reminder with a time without asking', () => {
    expect(decideFiling(capture(), context)).toEqual({
      outcome: 'auto',
      reasons: [],
      projectId: null,
      contactIds: [],
    });
  });

  it('uses the Kern thresholds', () => {
    expect(CONFIDENCE_HIGH).toBe(0.75);
    expect(CONFIDENCE_LOW).toBe(0.45);
    expect(decideFiling(capture({ confidence: 0.75 }), context).outcome).toBe('auto');
    expect(decideFiling(capture({ confidence: 0.6 }), context)).toMatchObject({
      outcome: 'review',
      reasons: ['doubtful_confidence'],
    });
    expect(decideFiling(capture({ confidence: 0.3 }), context)).toMatchObject({
      outcome: 'raw',
      reasons: ['low_confidence'],
    });
  });

  it('respects the per-user switch', () => {
    expect(decideFiling(capture(), { ...context, autoFileEnabled: false })).toMatchObject({
      outcome: 'review',
      reasons: ['auto_filing_disabled'],
    });
  });

  it('always asks when the AI has a question, or when a message or recipient is involved', () => {
    expect(
      decideFiling(
        capture({ requiresClarification: true, clarificationQuestion: 'Which dentist?' }),
        context,
      ).reasons,
    ).toEqual(['needs_clarification']);
    expect(decideFiling(capture({ intent: 'message' }), context).reasons).toEqual([
      'involves_message',
    ]);
    expect(decideFiling(capture({ intent: 'question' }), context).reasons).toEqual([
      'involves_message',
    ]);
    expect(decideFiling(capture({ messageDraft: 'Hi Julien' }), context).reasons).toEqual([
      'involves_message',
    ]);
    expect(
      decideFiling(capture({ people: [{ name: 'Julien', role: 'recipient' }] }), context).reasons,
    ).toEqual(['involves_recipient']);
  });

  it('links known people and projects, but never creates them on a guess', () => {
    expect(
      decideFiling(
        capture({
          people: [{ name: '  julien ', role: 'mentioned' }],
          suggestedProjectName: 'voice  app',
        }),
        context,
      ),
    ).toEqual({ outcome: 'auto', reasons: [], projectId: 'p1', contactIds: ['c1'] });

    const unknown = decideFiling(
      capture({
        people: [{ name: 'Karin', role: 'mentioned' }],
        suggestedProjectName: 'Garden shed',
      }),
      context,
    );
    expect(unknown).toEqual({
      outcome: 'review',
      reasons: ['unknown_person', 'unknown_project'],
      projectId: null,
      contactIds: [],
    });
  });

  it('keeps a project explicitly chosen by the user, even when review is needed', () => {
    const needsReview = decideFiling(capture({ confidence: 0.6 }), context);
    expect(projectIdForFiling(needsReview, 'chosen-project')).toBe('chosen-project');
    expect(projectIdForFiling(needsReview)).toBeNull();
  });
});
