import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { extractRetrievedSources, outputTextFrom } from '../_shared/research/openai-response.ts';
import {
  researchRequestSchema,
  researchSynthesisJsonSchema,
  researchSynthesisSchema,
} from '../_shared/research/schemas.ts';
import {
  canonicalSourceUrl,
  inferResearchSubject,
  selectReliableSources,
} from '../_shared/research/source-policy.ts';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};
const maximumRequestBytes = 8_000;
const maximumResearchesPerMinute = 2;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function responseBody(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > maximumRequestBytes) return null;
  const text = await request.text();
  if (text.length > maximumRequestBytes) return null;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

async function openAiFailure(response: Response) {
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: unknown };
  } | null;
  const message = payload?.error?.message;
  const safeMessage = typeof message === 'string' ? message.slice(0, 280) : null;
  console.error('Research provider request failed with status', response.status);
  if (response.status === 401 || response.status === 403) {
    return json({ error: 'OpenAI rejected the server-side API key.' }, 502);
  }
  if (response.status === 429) {
    return json({ error: 'Research is temporarily rate limited. Please try again shortly.' }, 429);
  }
  return json(
    {
      error: safeMessage
        ? `Research provider request failed (${response.status}): ${safeMessage}`
        : `Research provider request failed (${response.status}).`,
    },
    502,
  );
}

function freshnessReuseWindow(freshness: string) {
  if (freshness === 'current') return 24 * 60 * 60 * 1000;
  if (freshness === 'recent') return 7 * 24 * 60 * 60 * 1000;
  return 90 * 24 * 60 * 60 * 1000;
}

function researchInstructions(goal: string | null, freshness: string, date: string) {
  return `You are a careful research assistant. Today's date is ${date}. Research the user's topic using web search before answering.

Research goal: ${goal ?? 'general_background'}.
Freshness requirement: ${freshness}.

Use primary or authoritative sources first. For Belgian statistics, prefer Statbel, the National Bank of Belgium and Eurostat. For EU law, prefer europa.eu or EUR-Lex. For scientific claims, prefer peer-reviewed research, universities or authoritative research institutions. For company financial results, prefer company filings or investor relations. For product functionality, prefer official documentation.

Do not invent a URL, publisher, publication date, statistic or citation. A source URL in keyFindings must be an exact URL returned by the web search. Each key finding needs at least one source URL. If credible sources conflict, state that clearly in counterpoints and reduce confidence. Avoid Tier 5 social, forum and blog sources as primary evidence. Keep the direct answer concise, and make talking points practical for a meeting. Never claim research is verified when it lacks retrieved evidence.`;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  let sessionId: string | null = null;
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
    if (!openaiKey?.startsWith('sk-')) {
      return json({ error: 'HANDLED_OPENAI_KEY is not configured correctly.' }, 503);
    }

    const rawBody = await responseBody(request);
    if (rawBody === null) return json({ error: 'Research requests are limited to 8 KB.' }, 413);
    if (rawBody === undefined) return json({ error: 'Invalid JSON request.' }, 400);
    const parsedRequest = researchRequestSchema.safeParse(rawBody);
    if (!parsedRequest.success) return json({ error: 'Research request is invalid.' }, 400);

    const userClient = createClient(url, publishableKey, {
      global: { headers: { Authorization: token } },
    });
    const { data: auth, error: authError } = await userClient.auth.getUser();
    if (authError || !auth.user) return json({ error: 'Authentication is required.' }, 401);
    const userId = auth.user.id;
    const input = parsedRequest.data;
    const admin = createClient(url, serviceRoleKey);

    if (input.actionId) {
      const { data: action, error: actionError } = await admin
        .from('actions')
        .select('id, voice_capture_id')
        .eq('id', input.actionId)
        .eq('user_id', userId)
        .single();
      if (actionError || !action || action.voice_capture_id !== input.captureId) {
        return json({ error: 'This note is not available for research.' }, 404);
      }
    }

    const { data: capture, error: captureError } = await admin
      .from('voice_captures')
      .select('id, transcript')
      .eq('id', input.captureId)
      .eq('user_id', userId)
      .single();
    if (captureError || !capture?.transcript?.trim()) {
      return json({ error: 'A transcribed capture is required for research.' }, 422);
    }

    const now = new Date();
    const reuseSince = new Date(now.getTime() - freshnessReuseWindow(input.researchFreshness));
    let reusableQuery = admin
      .from('research_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('topic', input.topic)
      .eq('research_freshness', input.researchFreshness)
      .eq('status', 'completed')
      .gte('completed_at', reuseSince.toISOString())
      .order('completed_at', { ascending: false })
      .limit(1);
    reusableQuery = input.actionId
      ? reusableQuery.eq('action_id', input.actionId)
      : reusableQuery.is('action_id', null);
    const { data: reusable } = await reusableQuery.maybeSingle();
    if (reusable) return json({ researchSessionId: reusable.id, reused: true });

    const oneMinuteAgo = new Date(now.getTime() - 60_000).toISOString();
    const { count: recentResearchCount, error: rateError } = await admin
      .from('research_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneMinuteAgo);
    if (rateError) return json({ error: 'Research protection could not be checked.' }, 500);
    if ((recentResearchCount ?? 0) >= maximumResearchesPerMinute) {
      return json({ error: 'Please wait a minute before starting more research.' }, 429);
    }

    const { data: session, error: insertError } = await admin
      .from('research_sessions')
      .insert({
        action_id: input.actionId ?? null,
        original_query: capture.transcript,
        research_freshness: input.researchFreshness,
        research_goal: input.researchGoal,
        status: 'processing',
        topic: input.topic,
        user_id: userId,
        voice_capture_id: capture.id,
      })
      .select('id')
      .single();
    if (insertError || !session)
      return json({ error: 'Research session could not be created.' }, 500);
    sessionId = session.id;

    async function markFailed() {
      await admin.from('research_sessions').update({ status: 'failed' }).eq('id', sessionId);
    }

    const researchResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_RESEARCH_MODEL') ?? 'gpt-5.4',
        store: false,
        max_tool_calls: 6,
        tool_choice: 'required',
        tools: [{ type: 'web_search' }],
        include: ['web_search_call.action.sources'],
        instructions: researchInstructions(
          input.researchGoal,
          input.researchFreshness,
          now.toISOString(),
        ),
        input: `Topic: ${input.topic}\n\nOriginal voice capture:\n${capture.transcript}`,
        text: {
          format: {
            type: 'json_schema',
            name: 'research_synthesis',
            strict: true,
            schema: researchSynthesisJsonSchema,
          },
        },
      }),
    });
    if (!researchResponse.ok) {
      await markFailed();
      return await openAiFailure(researchResponse);
    }

    const responsePayload = (await researchResponse.json()) as Record<string, unknown>;
    const responseText = outputTextFrom(responsePayload);
    if (!responseText) {
      await markFailed();
      return json({ error: 'Research did not return a structured result.' }, 502);
    }
    const parsedSynthesis = researchSynthesisSchema.safeParse(
      (() => {
        try {
          return JSON.parse(responseText);
        } catch {
          return null;
        }
      })(),
    );
    if (!parsedSynthesis.success) {
      await markFailed();
      return json({ error: 'Research returned an invalid structured result.' }, 502);
    }

    const subject = inferResearchSubject(input.topic);
    const sources = selectReliableSources(extractRetrievedSources(responsePayload), subject);
    if (sources.length === 0) {
      await markFailed();
      return json({ error: 'Research did not retrieve reliable sources. Please try again.' }, 502);
    }
    const { data: storedSources, error: sourceInsertError } = await admin
      .from('research_sources')
      .insert(
        sources.map((source) => ({
          accessed_at: now.toISOString(),
          metadata: source.metadata,
          published_at: source.publishedAt,
          publisher: source.publisher,
          research_session_id: sessionId,
          source_type: source.sourceType,
          title: source.title,
          trust_tier: source.trustTier,
          url: canonicalSourceUrl(source.url),
        })),
      )
      .select('id, url');
    if (sourceInsertError || !storedSources) {
      await markFailed();
      return json({ error: 'Research sources could not be saved.' }, 500);
    }

    const sourceIdByUrl = new Map(
      storedSources.map((source) => [canonicalSourceUrl(source.url), source.id]),
    );
    const supportedFindings = parsedSynthesis.data.keyFindings
      .map((finding) => ({
        ...finding,
        sourceIds: [
          ...new Set(
            finding.sourceUrls
              .map((url) => sourceIdByUrl.get(canonicalSourceUrl(url)))
              .filter(Boolean),
          ),
        ],
      }))
      .filter((finding) => finding.sourceIds.length > 0);
    if (supportedFindings.length === 0) {
      await markFailed();
      return json({ error: 'Research findings could not be linked to retrieved sources.' }, 502);
    }

    const { data: storedFindings, error: findingInsertError } = await admin
      .from('research_findings')
      .insert(
        supportedFindings.map((finding) => ({
          claim: finding.claim,
          confidence: finding.confidence,
          explanation: finding.explanation || null,
          research_session_id: sessionId,
        })),
      )
      .select('id');
    if (findingInsertError || !storedFindings) {
      await markFailed();
      return json({ error: 'Research findings could not be saved.' }, 500);
    }

    const findingLinks = storedFindings.flatMap((finding, index) =>
      supportedFindings[index].sourceIds.map((sourceId) => ({
        research_finding_id: finding.id,
        research_source_id: sourceId,
      })),
    );
    const { error: linkError } = await admin.from('research_finding_sources').insert(findingLinks);
    if (linkError) {
      await markFailed();
      return json({ error: 'Research citations could not be saved.' }, 500);
    }

    const { error: completionError } = await admin
      .from('research_sessions')
      .update({
        completed_at: now.toISOString(),
        counterpoints: parsedSynthesis.data.counterpoints,
        direct_answer: parsedSynthesis.data.directAnswer,
        executive_summary: parsedSynthesis.data.executiveSummary,
        overall_confidence: parsedSynthesis.data.overallConfidence,
        researched_at: now.toISOString(),
        share_message: parsedSynthesis.data.shareMessage,
        status: 'completed',
        talking_points: parsedSynthesis.data.talkingPoints,
      })
      .eq('id', sessionId)
      .eq('user_id', userId);
    if (completionError) {
      await markFailed();
      return json({ error: 'Research result could not be saved.' }, 500);
    }

    return json({ researchSessionId: sessionId, reused: false });
  } catch (error) {
    if (sessionId) {
      const url = Deno.env.get('SUPABASE_URL');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (url && serviceRoleKey) {
        await createClient(url, serviceRoleKey)
          .from('research_sessions')
          .update({ status: 'failed' })
          .eq('id', sessionId);
      }
    }
    console.error(
      'research failed unexpectedly',
      error instanceof Error ? error.name : 'Unknown error',
    );
    return json({ error: 'Research failed unexpectedly. Please try again.' }, 500);
  }
});
