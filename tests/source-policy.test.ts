import { describe, expect, it } from '@jest/globals';

import {
  inferResearchSubject,
  selectReliableSources,
} from '../supabase/functions/_shared/research/source-policy';
import { extractRetrievedSources } from '../supabase/functions/_shared/research/openai-response';

describe('source policy', () => {
  it('keeps URL-only sources returned by a web search call', () => {
    const sources = extractRetrievedSources({
      output: [
        {
          type: 'web_search_call',
          action: {
            type: 'search',
            sources: [{ type: 'url', url: 'https://www.gold.org/goldhub/data/gold-prices' }],
          },
        },
      ],
    });

    expect(sources).toEqual([
      expect.objectContaining({
        title: 'Source: gold.org',
        publisher: 'gold.org',
        url: 'https://www.gold.org/goldhub/data/gold-prices',
      }),
    ]);
  });

  it('prefers a Belgian statistics source for Belgian economic research', () => {
    const sources = selectReliableSources(
      [
        {
          title: 'AI use by enterprises',
          publisher: 'Statbel',
          url: 'https://statbel.fgov.be/en/themes/enterprises/ai-use',
          publishedAt: null,
          metadata: {},
        },
        {
          title: 'Discussion thread',
          publisher: null,
          url: 'https://reddit.com/r/belgium/example',
          publishedAt: null,
          metadata: {},
        },
      ],
      inferResearchSubject('AI adoption in Belgian companies'),
    );

    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({ sourceType: 'statistics', trustTier: 1 });
  });
});
