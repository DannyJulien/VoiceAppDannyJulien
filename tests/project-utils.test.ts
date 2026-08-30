import { describe, expect, it } from '@jest/globals';

import {
  maxProjectSummaryLength,
  normalizedProjectSummary,
} from '../src/features/projects/project-utils';

describe('project summaries', () => {
  it('stores a concise, single-line version of the context', () => {
    expect(normalizedProjectSummary('  Refresh\n the mobile  app  ')).toBe(
      'Refresh the mobile app',
    );
  });

  it('uses a deliberately small context limit for AI filing', () => {
    expect(maxProjectSummaryLength).toBe(500);
  });
});
