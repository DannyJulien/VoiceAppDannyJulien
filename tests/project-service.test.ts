import { describe, expect, it } from '@jest/globals';

import { isMissingProjectSummaryColumn } from '../src/features/projects/project-utils';

describe('project creation compatibility', () => {
  it('recognizes the Postgres error when a summary column is not deployed yet', () => {
    expect(
      isMissingProjectSummaryColumn({
        code: '42703',
        message: 'column "summary" of relation "projects" does not exist',
      }),
    ).toBe(true);
  });

  it('recognizes a stale PostgREST schema cache for the summary column', () => {
    expect(
      isMissingProjectSummaryColumn({
        code: 'PGRST204',
        message: "Could not find the 'summary' column of 'projects' in the schema cache",
      }),
    ).toBe(true);
  });

  it('does not hide unrelated project errors', () => {
    expect(
      isMissingProjectSummaryColumn({
        code: '42501',
        message: 'new row violates row-level security policy for table "projects"',
      }),
    ).toBe(false);
  });
});
