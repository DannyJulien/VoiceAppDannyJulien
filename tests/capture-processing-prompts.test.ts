import { describe, expect, it } from '@jest/globals';

import {
  captureIntents,
  captureProcessingInstructions,
  describeCurrentMoment,
  sanitizeScheduledAt,
} from '../supabase/functions/_shared/capture-processing-prompts';

describe('capture processing prompts', () => {
  // A Saturday afternoon in Brussels (UTC+2 in summer): 2026-08-29 14:05 local.
  const now = new Date('2026-08-29T12:05:00Z');
  const instructions = captureProcessingInstructions({
    knownChecklists: 'Existing open checklists: "Cycling holiday" (id: "checklist-id").',
    knownProjects: 'Existing projects: "Handled".',
    now,
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
    expect(instructions).toContain('Existing open checklists: "Cycling holiday"');
    expect(instructions).toContain(
      'Never invent a critical time, contact, fact, task, project, or commitment.',
    );
    expect(instructions).toContain("Preserve the user's language");
  });

  it('tells the model what today is, in the user timezone, so relative dates resolve correctly', () => {
    expect(instructions).toContain('Right now it is Saturday 2026-08-29 14:05 in Europe/Brussels.');
    expect(instructions).toContain('Resolve relative dates');
    expect(instructions).toContain('never earlier than the current moment');
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
    expect(instructions).toContain('checklistTargetActionId: set this only');
  });

  it('only asks the model to keep places that were explicitly stated', () => {
    expect(instructions).toContain('location: return a concise human-readable place only when');
    expect(instructions).toContain('never invent an address, city, country, or place from context');
  });
});

describe('describeCurrentMoment', () => {
  it('renders weekday, date and time in the requested timezone', () => {
    expect(describeCurrentMoment(new Date('2026-08-29T12:05:00Z'), 'Europe/Brussels')).toBe(
      'Saturday 2026-08-29 14:05',
    );
    // Same instant is still Friday evening in Los Angeles.
    expect(describeCurrentMoment(new Date('2026-08-29T05:30:00Z'), 'America/Los_Angeles')).toBe(
      'Friday 2026-08-28 22:30',
    );
  });

  it('falls back to UTC when the timezone is not a valid IANA name', () => {
    expect(describeCurrentMoment(new Date('2026-08-29T12:05:00Z'), 'Not/AZone')).toBe(
      'Saturday 2026-08-29 12:05',
    );
  });
});

describe('sanitizeScheduledAt', () => {
  const now = new Date('2026-08-29T12:05:00Z');

  it('keeps null and future dates untouched', () => {
    expect(sanitizeScheduledAt(null, now)).toBeNull();
    expect(sanitizeScheduledAt('2026-09-04T09:00:00+02:00', now)).toBe('2026-09-04T09:00:00+02:00');
  });

  it('keeps a date that is at most one day in the past (still the same reminder)', () => {
    expect(sanitizeScheduledAt('2026-08-29T09:00:00+02:00', now)).toBe('2026-08-29T09:00:00+02:00');
    expect(sanitizeScheduledAt('2026-08-28T14:10:00+02:00', now)).toBe('2026-08-28T14:10:00+02:00');
  });

  it('blanks a date that is clearly in the past, such as a guessed wrong year', () => {
    expect(sanitizeScheduledAt('2024-06-07T09:00:00+02:00', now)).toBeNull();
    expect(sanitizeScheduledAt('2026-08-27T09:00:00+02:00', now)).toBeNull();
  });

  it('blanks a value that is not a real date', () => {
    expect(sanitizeScheduledAt('next friday', now)).toBeNull();
  });
});
