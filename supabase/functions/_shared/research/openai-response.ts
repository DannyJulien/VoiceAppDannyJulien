import type { RetrievedSource } from './source-policy.ts';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function outputTextFrom(response: Record<string, unknown>) {
  if (typeof response.output_text === 'string') return response.output_text;

  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    const itemRecord = asRecord(item);
    const content = Array.isArray(itemRecord?.content) ? itemRecord.content : [];
    for (const part of content) {
      const partRecord = asRecord(part);
      if (partRecord?.type === 'output_text' && typeof partRecord.text === 'string') {
        return partRecord.text;
      }
    }
  }

  return null;
}

function dateFromMetadata(value: Record<string, unknown>) {
  const candidate = asString(value.published_at) ?? asString(value.publishedAt);
  if (!candidate || Number.isNaN(new Date(candidate).getTime())) return null;
  return new Date(candidate).toISOString();
}

function sourceFallback(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export function extractRetrievedSources(response: Record<string, unknown>): RetrievedSource[] {
  const sources: RetrievedSource[] = [];
  const visited = new Set<unknown>();

  function visit(value: unknown, depth = 0): void {
    if (depth > 12 || !value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }

    const record = value as Record<string, unknown>;
    const url = asString(record.url);
    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'https:') {
          const fallback = sourceFallback(parsed.toString());
          const title =
            asString(record.title) ?? asString(record.name) ?? (fallback ? `Source: ${fallback}` : null);
          if (!title) return;
          const publisher =
            asString(record.publisher) ??
            asString(record.site_name) ??
            asString(record.siteName) ??
            fallback;
          sources.push({
            title,
            publisher,
            url: parsed.toString(),
            publishedAt: dateFromMetadata(record),
            metadata: {
              citationType: asString(record.type),
              description: asString(record.description),
            },
          });
        }
      } catch {
        // Invalid URLs are intentionally ignored before persistence.
      }
    }

    Object.values(record).forEach((nested) => visit(nested, depth + 1));
  }

  visit(response);
  return sources;
}
