export const captureIntents = [
  'note',
  'task',
  'reminder',
  'message',
  'question',
  'statement',
  'research_request',
] as const;

export type CaptureIntent = (typeof captureIntents)[number];

type ProcessingPromptInput = {
  knownChecklists: string;
  knownProjects: string;
  now: Date;
  timezone: string;
};

/**
 * "Saturday 2026-08-29 14:05" for the given instant in the user's timezone.
 * The model needs the weekday to resolve "Friday" and the year to avoid guessing
 * one from its training data. An unknown timezone name falls back to UTC.
 */
export function describeCurrentMoment(now: Date, timezone: string): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-US', { ...options, timeZone: timezone });
  } catch {
    formatter = new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' });
  }
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    formatter.formatToParts(now).find((item) => item.type === type)?.value ?? '';
  // Some engines print midnight as "24" with hour12: false.
  const hour = part('hour') === '24' ? '00' : part('hour');
  return `${part('weekday')} ${part('year')}-${part('month')}-${part('day')} ${hour}:${part('minute')}`;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The model occasionally resolves a relative date against the wrong year. A
 * reminder more than a day in the past cannot be what the user meant, so it is
 * dropped rather than saved. Anything unparsable is dropped for the same reason.
 */
export function sanitizeScheduledAt(scheduledAt: string | null, now: Date): string | null {
  if (scheduledAt === null) return null;
  const timestamp = Date.parse(scheduledAt);
  if (Number.isNaN(timestamp)) return null;
  return now.getTime() - timestamp > ONE_DAY_MS ? null : scheduledAt;
}

const processingTemplates: Record<CaptureIntent, string> = {
  note: `NOTE TEMPLATE
- title: a concise, specific topic title.
- summary: preserve the useful substance in a clear, detailed note: important context, facts, decisions, and explicitly stated next steps. Do not invent details.
- scheduledAt and messageDraft: null unless the capture independently requires a reminder or message intent.`,
  task: `TASK TEMPLATE
- title: start with the explicitly stated action and name the concrete outcome.
- summary: state the task's context, constraints, and next step precisely enough to act on it. Do not turn background discussion into extra tasks.
- scheduledAt: only set it when the user gave an unambiguous date or time. Never invent a due date, owner, or priority.
- messageDraft: null unless the capture is primarily a message to someone.`,
  reminder: `REMINDER TEMPLATE
- title: state what to remember or do, including an explicit time cue when one was spoken.
- summary: keep it short and practical, retaining only relevant context.
- scheduledAt: set it only for an explicit, unambiguous date or time in the user's timezone; otherwise null and ask for clarification only if timing is essential.
- messageDraft: null.`,
  message: `MESSAGE TEMPLATE
- title: identify the intended communication and recipient when known.
- summary: retain the context and outcome the message should communicate.
- messageDraft: write a ready-to-review draft in the user's language. Do not invent a recipient, promise, fact, or sign-off.
- people: mark a clearly intended recipient as recipient. scheduledAt is null unless the user explicitly requested a reminder instead.`,
  question: `QUESTION TEMPLATE
- title: preserve the user's exact question or decision to be made.
- summary: capture the scope, constraints, and known context without answering from memory or inventing facts.
- topic: use the subject being asked about when clear.
- couldBenefitFromResearch: true only when reliable external facts would materially help answer the question; then state a focused research reason and goal.`,
  statement: `STATEMENT TEMPLATE
- title: state the core claim, observation, or decision succinctly.
- summary: preserve the reasoning, evidence, implications, and explicitly stated next steps as a useful detailed record. Do not present unverified claims as facts.
- couldBenefitFromResearch: true only when verifying, challenging, or expanding the statement would be materially useful.`,
  research_request: `RESEARCH REQUEST TEMPLATE
- title: describe the investigation, not an assumed answer.
- summary: turn the capture into a crisp research brief with the exact question, scope, constraints, and desired outcome.
- topic: set the research subject when clear.
- couldBenefitFromResearch: always true. Set researchReason and researchGoal to explain why research is needed and researchFreshness to the needed recency. Do not claim that research has already been performed.
- scheduledAt and messageDraft: null unless they are independently explicit.`,
};

/**
 * A single Responses call keeps capture processing fast while still requiring
 * the model to use a distinct output template for the intent it selects.
 */
export function captureProcessingInstructions({
  knownChecklists,
  knownProjects,
  now,
  timezone,
}: ProcessingPromptInput): string {
  const templates = captureIntents.map((intent) => processingTemplates[intent]).join('\n\n');

  return `Turn one voice capture into one useful action or useful context. The user's timezone is ${timezone}. Right now it is ${describeCurrentMoment(now, timezone)} in ${timezone}. First determine the one best intent. Then follow exactly the processing template for that intent below when filling the structured response. The templates deliberately produce different levels of detail for different capture types.

GLOBAL RULES
- Never invent a critical time, contact, fact, task, project, or commitment.
- Resolve relative dates such as "tomorrow", "Friday", or "next week" against the current moment above, so the result is never earlier than the current moment. "Friday" means the next Friday from today. Return scheduledAt as an ISO 8601 timestamp with the user's UTC offset.
- Use requiresClarification with a question when a key detail is missing.
- Suggest one category only when confident; otherwise use inbox.
- Set suggestedProjectName to an exact matching existing project name when clearly related. When no existing name fits but the capture clearly names a substantial ongoing project, propose a concise new project name. Otherwise use null. Never use a person's name or a generic one-off task as a project.
- Set fields that do not apply to the selected intent to null. In particular, messageDraft is normally only for message, and scheduledAt needs an explicit unambiguous time.
- Preserve the user's language in title, summary, clarificationQuestion, and messageDraft.
- checklistItems: return an empty array unless the user explicitly gave a short to-do list or a set of distinct items for one subject. When there is a list, return its items in spoken order, without checkbox symbols, numbering, invented items, or duplicates. Keep one clear title for the whole checklist; never turn each list item into a separate action.
- checklistTargetActionId: set this only when the user explicitly asks to add items to one existing checklist and exactly one checklist below clearly matches their named subject. Use that checklist's exact id and return only the new items in checklistItems. When the target is ambiguous, missing, or merely implied, return null and create a normal note instead. Never target a checklist based only on a similar word.

INTENT-SPECIFIC TEMPLATES
${templates}

${knownProjects}

${knownChecklists}`;
}
