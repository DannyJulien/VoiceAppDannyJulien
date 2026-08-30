import type { UnderstoodAction } from '@/features/actions/action-schema';
import { normalizedContactName } from '@/features/contacts/contact-utils';
import { normalizedProjectName } from '@/features/projects/project-utils';

/**
 * Confidence gate, modelled on Kern's classification gate.
 *
 * - `auto`:   confident and low-risk → filed without asking.
 * - `review`: doubtful, or a guard hit → waits in the Inbox with the AI's suggestions.
 * - `raw`:    too doubtful to trust anything → waits in the Inbox with suggestions stripped.
 */
export const CONFIDENCE_HIGH = 0.75;
export const CONFIDENCE_LOW = 0.45;

export type FilingOutcome = 'auto' | 'review' | 'raw';

export type FilingReason =
  | 'auto_filing_disabled'
  | 'low_confidence'
  | 'doubtful_confidence'
  | 'needs_clarification'
  | 'involves_message'
  | 'involves_recipient'
  | 'unknown_person'
  | 'unknown_project';

export type FilingDecision = {
  outcome: FilingOutcome;
  reasons: FilingReason[];
  /** Id of the existing project the capture will be filed under, when auto-filed. */
  projectId: string | null;
  /** Ids of the existing contacts to link, when auto-filed. */
  contactIds: string[];
};

export type FilingContext = {
  autoFileEnabled: boolean;
  projects: { id: string; name: string }[];
  contacts: { id: string; name: string }[];
};

/**
 * A project chosen directly by the user always wins over an AI suggestion.
 * The action can still wait in the Inbox for review, but it must not vanish
 * from the timeline the user deliberately opened.
 */
export function projectIdForFiling(
  decision: FilingDecision,
  explicitlyChosenProjectId?: string | null,
) {
  if (explicitlyChosenProjectId) return explicitlyChosenProjectId;
  return decision.outcome === 'auto' ? decision.projectId : null;
}

export function decideFiling(action: UnderstoodAction, context: FilingContext): FilingDecision {
  const reasons: FilingReason[] = [];
  let projectId: string | null = null;
  const contactIds: string[] = [];

  if (action.confidence < CONFIDENCE_LOW) {
    return { outcome: 'raw', reasons: ['low_confidence'], projectId, contactIds };
  }

  if (!context.autoFileEnabled) reasons.push('auto_filing_disabled');
  if (action.confidence < CONFIDENCE_HIGH) reasons.push('doubtful_confidence');
  if (action.requiresClarification) reasons.push('needs_clarification');

  // Anything that could reach another person or that the user has to answer
  // themselves is never filed on the AI's word alone (D1 hybrid).
  if (
    action.intent === 'message' ||
    action.intent === 'question' ||
    action.intent === 'research_request' ||
    Boolean(action.messageDraft)
  ) {
    reasons.push('involves_message');
  }
  if (action.people.some((person) => person.role === 'recipient')) {
    reasons.push('involves_recipient');
  }

  // Never create a contact or a project on a guess. An unresolved match is a
  // reason to distrust the whole classification, as in Kern.
  for (const person of action.people) {
    const wanted = normalizedContactName(person.name);
    const contact = context.contacts.find((item) => normalizedContactName(item.name) === wanted);
    if (contact) contactIds.push(contact.id);
    else if (!reasons.includes('unknown_person')) reasons.push('unknown_person');
  }
  if (action.suggestedProjectName) {
    const wanted = normalizedProjectName(action.suggestedProjectName);
    const project = context.projects.find((item) => normalizedProjectName(item.name) === wanted);
    if (project) projectId = project.id;
    else reasons.push('unknown_project');
  }

  if (reasons.length) return { outcome: 'review', reasons, projectId: null, contactIds: [] };
  return { outcome: 'auto', reasons, projectId, contactIds };
}

export function filingReasonLabel(reason: FilingReason) {
  switch (reason) {
    case 'auto_filing_disabled':
      return 'automatic filing is off';
    case 'low_confidence':
      return 'the AI was not confident';
    case 'doubtful_confidence':
      return 'the AI was only fairly confident';
    case 'needs_clarification':
      return 'the AI has a question';
    case 'involves_message':
      return 'it involves a message or a question';
    case 'involves_recipient':
      return 'it is addressed to someone';
    case 'unknown_person':
      return 'it names a person you have not saved yet';
    case 'unknown_project':
      return 'it names a project that does not exist yet';
  }
}
