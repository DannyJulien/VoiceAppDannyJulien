import { describe, expect, it } from '@jest/globals';

import {
  buildProjectBrief,
  type ProjectBriefAction,
} from '@/features/projects/project-brief-utils';

const project = { id: 'project-1', name: 'Delta mobile app', summary: 'Ship a calm capture app.' };

function action(overrides: Partial<ProjectBriefAction>): ProjectBriefAction {
  return {
    action_type: 'note',
    archived_at: null,
    category: 'work',
    created_at: '2026-08-31T10:00:00.000Z',
    exported_at: null,
    id: 'note-1',
    scheduled_at: null,
    status: 'approved',
    summary: null,
    title: 'Untitled note',
    ...overrides,
  };
}

describe('project brief export', () => {
  const actions = [
    action({
      id: 'knowledge-1',
      title: 'Use one capture box',
      summary: 'Keep typed and spoken capture together.',
    }),
    action({ id: 'idea-1', category: 'idea', title: 'Offer a quiet mode' }),
    action({
      id: 'todo-1',
      action_type: 'task',
      scheduled_at: '2026-09-02T09:00:00.000Z',
      title: 'Test the export',
    }),
    action({ id: 'done-1', action_type: 'task', status: 'completed', title: 'Create the project' }),
    action({
      id: 'shipped-1',
      archived_at: '2026-08-30T09:00:00.000Z',
      exported_at: '2026-08-30T09:00:00.000Z',
      title: 'Previous decision',
    }),
  ];

  it('builds a self-contained full brief and ships knowledge and ideas', () => {
    const brief = buildProjectBrief({
      actions,
      generatedAt: '2026-08-31T12:00:00.000Z',
      mode: 'full',
      project,
    });

    expect(brief.content).toContain('## Goal');
    expect(brief.content).toContain('## Context (knowledge)');
    expect(brief.content).toContain('Use one capture box');
    expect(brief.content).toContain('## Ideas & open questions');
    expect(brief.content).toContain('Offer a quiet mode');
    expect(brief.content).toContain('## Next steps');
    expect(brief.content).toContain('Due: 2026-09-02T09:00:00.000Z');
    expect(brief.content).toContain('## History');
    expect(brief.content).toContain('Previous decision');
    expect(brief.archiveActionIds).toEqual(['knowledge-1', 'idea-1']);
    expect(brief.includedActionIds).toEqual([
      'knowledge-1',
      'shipped-1',
      'idea-1',
      'todo-1',
      'done-1',
    ]);
  });

  it('builds a new-only brief with only unshipped entries and every open todo', () => {
    const brief = buildProjectBrief({
      actions: [
        ...actions.map((item) =>
          item.id === 'knowledge-1' || item.id === 'idea-1'
            ? {
                ...item,
                archived_at: '2026-08-31T12:00:00.000Z',
                exported_at: '2026-08-31T12:00:00.000Z',
              }
            : item,
        ),
        action({ id: 'knowledge-2', title: 'New research finding' }),
      ],
      generatedAt: '2026-09-01T12:00:00.000Z',
      mode: 'new_only',
      project,
    });

    expect(brief.content).not.toContain('## Goal');
    expect(brief.content).not.toContain('Use one capture box');
    expect(brief.content).toContain('New research finding');
    expect(brief.content).toContain('Test the export');
    expect(brief.content).not.toContain('Previous decision');
    expect(brief.includedActionIds).toEqual(['knowledge-2', 'todo-1']);
    expect(brief.archiveActionIds).toEqual(['knowledge-2']);
  });
});
