import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@4.4.3';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

const actionSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'intent',
    'title',
    'summary',
    'topic',
    'couldBenefitFromResearch',
    'researchReason',
    'researchGoal',
    'researchFreshness',
    'people',
    'scheduledAt',
    'messageDraft',
    'confidence',
    'requiresClarification',
    'clarificationQuestion',
  ],
  properties: {
    intent: {
      type: 'string',
      enum: ['note', 'task', 'reminder', 'message', 'question', 'statement', 'research_request'],
    },
    title: { type: 'string' },
    summary: { type: 'string' },
    topic: { type: ['string', 'null'] },
    couldBenefitFromResearch: { type: 'boolean' },
    researchReason: { type: ['string', 'null'] },
    researchGoal: {
      type: ['string', 'null'],
      enum: [
        'answer_question',
        'support_claim',
        'challenge_claim',
        'meeting_preparation',
        'decision_support',
        'general_background',
        null,
      ],
    },
    researchFreshness: {
      type: 'string',
      enum: ['current', 'recent', 'historical', 'not_time_sensitive'],
    },
    people: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'role'],
        properties: {
          name: { type: 'string' },
          role: { type: 'string', enum: ['recipient', 'mentioned'] },
        },
      },
    },
    scheduledAt: { type: ['string', 'null'] },
    messageDraft: { type: ['string', 'null'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    requiresClarification: { type: 'boolean' },
    clarificationQuestion: { type: ['string', 'null'] },
  },
};

const understoodActionSchema = z.object({
  intent: z.enum([
    'note',
    'task',
    'reminder',
    'message',
    'question',
    'statement',
    'research_request',
  ]),
  title: z.string().trim().min(1).max(280),
  summary: z.string().trim().max(2_000),
  topic: z.string().trim().min(1).max(280).nullable(),
  couldBenefitFromResearch: z.boolean(),
  researchReason: z.string().trim().max(500).nullable(),
  researchGoal: z
    .enum([
      'answer_question',
      'support_claim',
      'challenge_claim',
      'meeting_preparation',
      'decision_support',
      'general_background',
    ])
    .nullable(),
  researchFreshness: z.enum(['current', 'recent', 'historical', 'not_time_sensitive']),
  people: z.array(
    z.object({
      name: z.string().trim().min(1).max(160),
      role: z.enum(['recipient', 'mentioned']),
    }),
  ),
  scheduledAt: z.string().datetime({ offset: true }).nullable(),
  messageDraft: z.string().trim().max(5_000).nullable(),
  confidence: z.number().min(0).max(1),
  requiresClarification: z.boolean(),
  clarificationQuestion: z.string().trim().max(500).nullable(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function openAiFailure(stage: 'Action understanding' | 'Transcription', response: Response) {
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: unknown };
  } | null;
  const providerMessage = payload?.error?.message;
  const safeProviderMessage =
    typeof providerMessage === 'string' ? providerMessage.slice(0, 280) : null;
  const status = response.status;

  console.error(`${stage} provider request failed with status ${status}`);

  if (status === 401 || status === 403) {
    return json(
      { error: 'OpenAI rejected the server-side API key. Check HANDLED_OPENAI_KEY.' },
      502,
    );
  }
  if (status === 429) {
    return json({ error: 'OpenAI has no available API credit or rate limit.' }, 502);
  }

  return json(
    {
      error: safeProviderMessage
        ? `${stage} provider request failed (${status}): ${safeProviderMessage}`
        : `${stage} provider request failed (${status}).`,
    },
    502,
  );
}

function outputTextFrom(response: Record<string, unknown>) {
  if (typeof response.output_text === 'string') return response.output_text;

  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as { content?: unknown }).content)
      ? (item as { content: unknown[] }).content
      : [];
    for (const part of content) {
      if (
        part &&
        typeof part === 'object' &&
        (part as { type?: unknown }).type === 'output_text' &&
        typeof (part as { text?: unknown }).text === 'string'
      ) {
        return (part as { text: string }).text;
      }
    }
  }

  return null;
}

async function fileForTranscription(audio: Blob, audioPath: string) {
  const header = new Uint8Array(await audio.slice(0, 4).arrayBuffer());
  const isWebM =
    header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3;
  const originalName = audioPath.split('/').at(-1) ?? 'capture.m4a';

  if (isWebM) {
    const basename = originalName.replace(/\.[^.]+$/, '');
    return new File([audio], `${basename}.webm`, { type: 'audio/webm' });
  }

  return new File([audio], originalName, { type: audio.type || 'audio/mp4' });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const token = request.headers.get('Authorization');
    const url = Deno.env.get('SUPABASE_URL');
    const publishableKey =
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const openaiKey = Deno.env.get('HANDLED_OPENAI_KEY');

    if (!token) return json({ error: 'Authentication is required.' }, 401);
    if (!url || !publishableKey || !serviceRoleKey) {
      return json({ error: 'Server configuration is incomplete.' }, 500);
    }
    if (!openaiKey) return json({ error: 'HANDLED_OPENAI_KEY is not configured yet.' }, 503);
    if (!openaiKey.startsWith('sk-')) {
      console.error('HANDLED_OPENAI_KEY has an invalid format.');
      return json(
        { error: 'HANDLED_OPENAI_KEY is malformed. Replace its value with the key only.' },
        503,
      );
    }

    const userClient = createClient(url, publishableKey, {
      global: { headers: { Authorization: token } },
    });
    const { data: auth, error: authError } = await userClient.auth.getUser();
    if (authError || !auth.user) return json({ error: 'Authentication is required.' }, 401);

    const payload = (await request.json().catch(() => null)) as {
      captureId?: string;
      timezone?: string;
    } | null;
    if (!payload?.captureId || !/^[0-9a-f-]{36}$/i.test(payload.captureId)) {
      return json({ error: 'A valid capture ID is required.' }, 400);
    }

    const admin = createClient(url, serviceRoleKey);
    const { data: capture, error: captureError } = await admin
      .from('voice_captures')
      .select('id, audio_path')
      .eq('id', payload.captureId)
      .eq('user_id', auth.user.id)
      .single();
    if (captureError || !capture?.audio_path) return json({ error: 'Capture not found.' }, 404);

    const { data: audio, error: downloadError } = await admin.storage
      .from('voice-captures')
      .download(capture.audio_path);
    if (downloadError || !audio) return json({ error: 'Audio could not be retrieved.' }, 502);
    if (audio.size > 25 * 1024 * 1024) {
      return json({ error: 'Audio is too large to process. Keep recordings under 25 MB.' }, 413);
    }

    const transcriptionForm = new FormData();
    transcriptionForm.append(
      'model',
      Deno.env.get('OPENAI_TRANSCRIPTION_MODEL') ?? 'gpt-4o-mini-transcribe',
    );
    transcriptionForm.append('file', await fileForTranscription(audio, capture.audio_path));
    const transcriptionResult = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: transcriptionForm,
    });
    if (!transcriptionResult.ok) return openAiFailure('Transcription', transcriptionResult);

    const transcriptionPayload = (await transcriptionResult.json()) as { text?: unknown };
    const transcript = transcriptionPayload.text;
    if (typeof transcript !== 'string' || transcript.trim().length === 0) {
      return json({ error: 'No speech was detected in the recording.' }, 422);
    }

    const aiResult = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:
          Deno.env.get('OPENAI_ACTION_MODEL') ?? Deno.env.get('OPENAI_MODEL') ?? 'gpt-4.1-mini',
        store: false,
        instructions: `Turn one voice capture into one useful action or useful context. The user's timezone is ${payload.timezone ?? 'UTC'}. Never invent a critical time or a contact. Use requiresClarification with a question when key details are missing. Set couldBenefitFromResearch only when external facts, a question, an argument, a decision, or meeting preparation would genuinely improve the capture. A normal personal reminder does not need research. For a direct question or research request, use question or research_request intent.`,
        input: transcript,
        text: {
          format: {
            type: 'json_schema',
            name: 'handled_action',
            strict: true,
            schema: actionSchema,
          },
        },
      }),
    });
    if (!aiResult.ok) return openAiFailure('Action understanding', aiResult);

    const aiPayload = (await aiResult.json()) as Record<string, unknown>;
    const outputText = outputTextFrom(aiPayload);
    if (!outputText) return json({ error: 'AI returned an invalid action.' }, 502);

    let action: unknown;
    try {
      action = JSON.parse(outputText);
    } catch {
      return json({ error: 'AI returned an invalid action.' }, 502);
    }

    const parsedAction = understoodActionSchema.safeParse(action);
    if (!parsedAction.success) return json({ error: 'AI returned an invalid action.' }, 502);

    const { error: updateError } = await admin
      .from('voice_captures')
      .update({ transcript, processing_status: 'transcribed' })
      .eq('id', capture.id);
    if (updateError) return json({ error: 'The transcript could not be saved.' }, 500);

    return json({ captureId: capture.id, transcript, action: parsedAction.data });
  } catch (error) {
    console.error(
      'process-capture failed unexpectedly',
      error instanceof Error ? error.name : 'Unknown error',
    );
    return json({ error: 'Voice processing failed unexpectedly.' }, 500);
  }
});
