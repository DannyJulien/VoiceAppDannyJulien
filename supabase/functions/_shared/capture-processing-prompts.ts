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
  timezone: string;
};

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
  timezone,
}: ProcessingPromptInput): string {
  const templates = captureIntents.map((intent) => processingTemplates[intent]).join('\n\n');

  return `Turn one voice capture into one useful action or useful context. The user's timezone is ${timezone}. First determine the one best intent. Then follow exactly the processing template for that intent below when filling the structured response. The templates deliberately produce different levels of detail for different capture types.

GLOBAL RULES
- Never invent a critical time, contact, fact, task, project, or commitment.
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
