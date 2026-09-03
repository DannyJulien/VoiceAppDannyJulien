import { describe, expect, it } from '@jest/globals';

import { understoodActionSchema } from '@/features/actions/action-schema';

const baseAction = {
  clarificationQuestion: null,
  confidence: 0.93,
  couldBenefitFromResearch: false,
  intent: 'note',
  location: null,
  messageDraft: null,
  people: [],
  researchFreshness: 'not_time_sensitive',
  researchGoal: null,
  researchReason: null,
  requiresClarification: false,
  scheduledAt: null,
  suggestedCategory: 'personal',
  suggestedProjectName: null,
  summary: 'A packing list for the cycling holiday.',
  title: 'Cycling holiday',
  topic: 'Cycling holiday',
};

describe('understood action checklist items', () => {
  it('keeps a distinct, ordered checklist on a capture', () => {
    const result = understoodActionSchema.parse({
      ...baseAction,
      checklistItems: ['Bicycle', 'Bike tent', 'bicycle', 'Water bottles'],
    });

    expect(result.checklistItems).toEqual(['Bicycle', 'Bike tent', 'Water bottles']);
  });

  it('keeps normal captures compatible by defaulting to an empty checklist', () => {
    const result = understoodActionSchema.parse(baseAction);

    expect(result.checklistItems).toEqual([]);
    expect(result.checklistTargetActionId).toBeNull();
    expect(result.location).toBeNull();
  });

  it('keeps a specific spoken place but rejects an empty location', () => {
    expect(
      understoodActionSchema.parse({ ...baseAction, location: 'Brussels Central' }).location,
    ).toBe('Brussels Central');
    expect(() => understoodActionSchema.parse({ ...baseAction, location: '   ' })).toThrow();
  });

  it('keeps an explicit existing checklist target with its additions', () => {
    const result = understoodActionSchema.parse({
      ...baseAction,
      checklistItems: ['Lights', 'Water bottles'],
      checklistTargetActionId: 'd24c3d05-61f1-4c7a-a0ed-1a75c77a42d1',
    });

    expect(result.checklistTargetActionId).toBe('d24c3d05-61f1-4c7a-a0ed-1a75c77a42d1');
    expect(result.checklistItems).toEqual(['Lights', 'Water bottles']);
  });
});
