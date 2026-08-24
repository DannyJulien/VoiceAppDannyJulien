import type { ResearchResult } from '@/features/research/research-schema';

export function createMeetingBriefing(result: ResearchResult) {
  const keyFindings = result.keyFindings.map((finding) => `• ${finding.claim}`).join('\n');
  const talkingPoints = result.talkingPoints.map((point) => `• ${point}`).join('\n');
  const sources = result.sources
    .map((source, index) => `${index + 1}. ${source.title} — ${source.url}`)
    .join('\n');

  return [
    `Preparation notes: ${result.topic}`,
    '',
    result.executiveSummary,
    '',
    'Key findings',
    keyFindings,
    '',
    'Talking points',
    talkingPoints,
    '',
    'Sources',
    sources,
  ].join('\n');
}

function icsEscape(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function icsDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('A valid meeting start is required.');
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

export type IcsEventInput = {
  description: string;
  end?: string | null;
  start: string;
  title: string;
  uid: string;
};

export function createIcsEvent({ description, end, start, title, uid }: IcsEventInput) {
  const now = icsDate(new Date().toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Handled//Research Briefing//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${icsEscape(uid)}`,
    `DTSTAMP:${now}`,
    `DTSTART:${icsDate(start)}`,
    ...(end ? [`DTEND:${icsDate(end)}`] : []),
    `SUMMARY:${icsEscape(title)}`,
    `DESCRIPTION:${icsEscape(description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.join('\r\n')}\r\n`;
}
