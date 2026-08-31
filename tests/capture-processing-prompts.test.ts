import { describe, expect, it } from '@jest/globals';

import {
  captureIntents,
  captureProcessingInstructions,
} from '../supabase/functions/_shared/capture-processing-prompts';

describe('capture processing prompts', () => {
  const instructions = captureProcessingInstructions({
    knownProjects: 'Existing projects: "Handled".',
    timezone: 'Europe/Brussels',
  });

  it('keeps every supported capture intent aligned with a distinct template', () => {
    expect(captureIntents).toEqual([
      'note',
      'task',
      'reminder',
      'message',
      'question',
      'statement',
      'research_request',
    ]);
    expect(instructions).toContain('NOTE TEMPLATE');
    expect(instructions).toContain('TASK TEMPLATE');
    expect(instructions).toContain('REMINDER TEMPLATE');
    expect(instructions).toContain('MESSAGE TEMPLATE');
    expect(instructions).toContain('QUESTION TEMPLATE');
    expect(instructions).toContain('STATEMENT TEMPLATE');
    expect(instructions).toContain('RESEARCH REQUEST TEMPLATE');
  });

  it('keeps the user context and safe common rules in every request', () => {
    expect(instructions).toContain("The user's timezone is Europe/Brussels.");
    expect(instructions).toContain('Existing projects: "Handled".');
    expect(instructions).toContain(
      'Never invent a critical time, contact, fact, task, project, or commitment.',
    );
    expect(instructions).toContain("Preserve the user's language");
  });

  it('gives the research and message responses their own output requirements', () => {
    expect(instructions).toContain('couldBenefitFromResearch: always true');
    expect(instructions).toContain('messageDraft: write a ready-to-review draft');
    expect(instructions).toContain('Never invent a due date, owner, or priority.');
  });

  it('asks the model to recognise explicit checklists without inventing items', () => {
    expect(instructions).toContain('checklistItems: return an empty array unless');
    expect(instructions).toContain(
      'without checkbox symbols, numbering, invented items, or duplicates',
    );
    expect(instructions).toContain('never turn each list item into a separate action');
  });
});
