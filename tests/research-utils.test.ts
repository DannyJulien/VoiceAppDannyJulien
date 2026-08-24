import { describe, expect, it } from '@jest/globals';

import { understoodActionSchema } from '@/features/actions/action-schema';
import { researchResultSchema, researchSourceSchema } from '@/features/research/research-schema';
import { shouldOfferResearch } from '@/features/research/research-utils';

const sourceId = '9a9af511-8b0c-4ea6-8a70-0e2f52597065';
const findingId = '08ab537f-4980-4a89-9a97-21f2e532bf8b';

describe('research recommendation', () => {
  it('does not recommend research for a normal reminder', () => {
    const action = understoodActionSchema.parse({
      intent: 'reminder',
      title: 'Call Mum',
      summary: '',
      people: [],
      scheduledAt: null,
      messageDraft: null,
      confidence: 0.9,
      requiresClarification: false,
      clarificationQuestion: null,
    });

    expect(shouldOfferResearch(action)).toBe(false);
  });

  it('recommends research for a factual statement and direct question', () => {
    const statement = understoodActionSchema.parse({
      intent: 'statement',
      title: 'AI adoption is rising',
      summary: '',
      people: [],
      scheduledAt: null,
      messageDraft: null,
      confidence: 0.8,
      requiresClarification: false,
      clarificationQuestion: null,
    });
    const question = understoodActionSchema.parse({
      ...statement,
      intent: 'question',
      title: 'How fast is AI adoption rising?',
    });

    expect(shouldOfferResearch(statement)).toBe(true);
    expect(shouldOfferResearch(question)).toBe(true);
  });
});

describe('research source validation', () => {
  it('rejects sources without a valid HTTPS URL', () => {
    expect(
      researchSourceSchema.safeParse({
        id: sourceId,
        title: 'Missing source',
        publisher: null,
        url: 'not-a-url',
        publishedAt: null,
        accessedAt: '2026-08-23T12:00:00.000Z',
        sourceType: 'other',
        trustTier: 5,
      }).success,
    ).toBe(false);
  });

  it('rejects a finding that cites an unsupported source', () => {
    expect(
      researchResultSchema.safeParse({
        id: 'b61941d0-11b4-4b07-a1d4-ccd19c370b52',
        topic: 'AI adoption',
        directAnswer: 'A supported answer.',
        executiveSummary: 'A supported summary.',
        shareMessage: 'A supported share message.',
        talkingPoints: [],
        counterpoints: [],
        overallConfidence: 'medium',
        researchedAt: '2026-08-23T12:00:00.000Z',
        sources: [
          {
            id: sourceId,
            title: 'Official source',
            publisher: null,
            url: 'https://example.gov/report',
            publishedAt: null,
            accessedAt: '2026-08-23T12:00:00.000Z',
            sourceType: 'government',
            trustTier: 1,
          },
        ],
        keyFindings: [
          {
            id: findingId,
            claim: 'A factual claim.',
            explanation: null,
            confidence: 'medium',
            sourceIds: ['a9d7e356-129f-4cb0-9325-7cb896554e44'],
          },
        ],
      }).success,
    ).toBe(false);
  });
});
