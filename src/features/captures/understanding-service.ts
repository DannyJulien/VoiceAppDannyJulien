import { FunctionsHttpError } from '@supabase/supabase-js';

import {
  fileUnderstoodAction,
  getOpenChecklistCandidates,
  type SavedAction,
} from '@/features/actions/action-service';
import { understoodActionSchema } from '@/features/actions/action-schema';
import { decideFiling, type FilingDecision } from '@/features/actions/filing-gate';
import { getProfile } from '@/features/auth/profile-service';
import { messageForCaptureError } from '@/features/captures/capture-utils';
import { getContacts } from '@/features/contacts/contact-service';
import { getProjects } from '@/features/projects/project-service';
import { getSupabaseClient } from '@/services/supabase/client';

const processCaptureFunction = 'process-captur';

type UnderstandingInput = {
  captureId?: string;
  projectId?: string | null;
  text?: string;
  timezone: string;
  userId: string;
};

export type FiledCapture = { action: SavedAction; decision: FilingDecision };

async function understand({ captureId, text, timezone, userId }: UnderstandingInput) {
  const [projects, checklists] = await Promise.all([
    getProjects(userId),
    getOpenChecklistCandidates(userId),
  ]);
  const { data, error } = await getSupabaseClient().functions.invoke(processCaptureFunction, {
    body: {
      captureId,
      checklists,
      projects: projects.map((project) => ({ name: project.name, summary: project.summary })),
      text,
      timezone,
    },
  });
  if (error || !data?.action || typeof data.captureId !== 'string') {
    throw error ?? new Error('AI processing did not return an action.');
  }

  const action = understoodActionSchema.safeParse(data.action);
  if (!action.success) throw new Error('AI returned an invalid action. Please try again.');
  return { action: action.data, captureId: data.captureId, projects };
}

async function fileCapture(input: UnderstandingInput): Promise<FiledCapture> {
  const { action, captureId, projects } = await understand(input);
  const [profile, contacts] = await Promise.all([
    getProfile(input.userId),
    getContacts(input.userId),
  ]);
  const decision = decideFiling(action, {
    autoFileEnabled: profile.auto_file_captures,
    contacts,
    projects,
  });
  const saved = await fileUnderstoodAction({
    action,
    captureId,
    decision,
    projectId: input.projectId,
    timezone: input.timezone,
    userId: input.userId,
  });
  return { action: saved, decision };
}

export function saveVoiceCapture(input: Omit<UnderstandingInput, 'text'>) {
  return fileCapture(input);
}

export function saveTypedCapture(
  input: Required<Pick<UnderstandingInput, 'text' | 'timezone' | 'userId'>> &
    Pick<UnderstandingInput, 'projectId'>,
) {
  return fileCapture(input);
}

export async function messageForUnderstandingError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    const payload = (await error.context.json().catch(() => null)) as { error?: unknown } | null;
    if (typeof payload?.error === 'string') return payload.error;
  }
  return messageForCaptureError(error);
}
