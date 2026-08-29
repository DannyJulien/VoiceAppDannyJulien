import { FunctionsHttpError } from '@supabase/supabase-js';

import { createPendingAction, type SavedAction } from '@/features/actions/action-service';
import { understoodActionSchema } from '@/features/actions/action-schema';
import { messageForCaptureError } from '@/features/captures/capture-utils';
import { getProjects } from '@/features/projects/project-service';
import { getSupabaseClient } from '@/services/supabase/client';

const processCaptureFunction = 'process-captur';

type UnderstandingInput = {
  captureId?: string;
  text?: string;
  timezone: string;
  userId: string;
};

async function understand({ captureId, text, timezone, userId }: UnderstandingInput) {
  const projects = await getProjects(userId);
  const { data, error } = await getSupabaseClient().functions.invoke(processCaptureFunction, {
    body: {
      captureId,
      projectNames: projects.map((project) => project.name),
      text,
      timezone,
    },
  });
  if (error || !data?.action || typeof data.captureId !== 'string') {
    throw error ?? new Error('AI processing did not return an action.');
  }

  const action = understoodActionSchema.safeParse(data.action);
  if (!action.success) throw new Error('AI returned an invalid action. Please try again.');
  return { action: action.data, captureId: data.captureId };
}

export async function saveVoiceCaptureToInbox({
  captureId,
  timezone,
  userId,
}: Omit<UnderstandingInput, 'text'>): Promise<SavedAction> {
  const understood = await understand({ captureId, timezone, userId });
  return createPendingAction({ ...understood, timezone, userId });
}

export async function saveTypedCaptureToInbox({
  text,
  timezone,
  userId,
}: Required<Pick<UnderstandingInput, 'text' | 'timezone' | 'userId'>>): Promise<SavedAction> {
  const understood = await understand({ text, timezone, userId });
  return createPendingAction({ ...understood, timezone, userId });
}

export async function messageForUnderstandingError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    const payload = (await error.context.json().catch(() => null)) as { error?: unknown } | null;
    if (typeof payload?.error === 'string') return payload.error;
  }
  return messageForCaptureError(error);
}
