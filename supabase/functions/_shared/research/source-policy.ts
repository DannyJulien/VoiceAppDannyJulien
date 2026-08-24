export type ResearchSubject =
  | 'belgian_statistics'
  | 'eu_regulation'
  | 'scientific'
  | 'company_financials'
  | 'product_documentation'
  | 'general';

export type SourceType =
  | 'government'
  | 'statistics'
  | 'eu_institution'
  | 'regulation'
  | 'university'
  | 'research'
  | 'news'
  | 'company'
  | 'documentation'
  | 'other';

export type RetrievedSource = {
  title: string;
  publisher: string | null;
  url: string;
  publishedAt: string | null;
  metadata: Record<string, unknown>;
};

export type EvaluatedSource = RetrievedSource & {
  sourceType: SourceType;
  trustTier: 1 | 2 | 3 | 4 | 5;
  score: number;
};

const tierOneHosts = new Set([
  'europa.eu',
  'eur-lex.europa.eu',
  'ec.europa.eu',
  'statbel.fgov.be',
  'nbb.be',
  'ec.europa.eu/eurostat',
]);
const newsHosts = new Set([
  'reuters.com',
  'apnews.com',
  'bbc.com',
  'ft.com',
  'economist.com',
  'nytimes.com',
  'theguardian.com',
  'politico.eu',
]);
const socialHosts = new Set([
  'reddit.com',
  'x.com',
  'twitter.com',
  'facebook.com',
  'linkedin.com',
  'medium.com',
  'substack.com',
]);

function hostFor(url: string) {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
}

function hasHost(host: string, candidate: string) {
  return host === candidate || host.endsWith(`.${candidate}`);
}

export function inferResearchSubject(topic: string): ResearchSubject {
  const value = topic.toLowerCase();
  if (/belgi|statbel|eurostat|national bank|nbb/.test(value)) return 'belgian_statistics';
  if (/eu |european union|europa|eur-lex|directive|regulation/.test(value)) return 'eu_regulation';
  if (/study|research|clinical|scientific|peer.review|university/.test(value)) return 'scientific';
  if (/revenue|earnings|investor|financial result|annual report/.test(value)) {
    return 'company_financials';
  }
  if (/documentation|api|sdk|how does .* work|sap/.test(value)) return 'product_documentation';
  return 'general';
}

export function canonicalSourceUrl(value: string) {
  const url = new URL(value);
  url.hash = '';
  url.searchParams.delete('utm_source');
  url.searchParams.delete('utm_medium');
  url.searchParams.delete('utm_campaign');
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/$/, '');
  return url.toString();
}

export function evaluateSource(source: RetrievedSource, subject: ResearchSubject): EvaluatedSource {
  const host = hostFor(source.url);
  const path = new URL(source.url).pathname.toLowerCase();
  const isGovernment =
    host.endsWith('.gov') || host.endsWith('.gov.uk') || host.endsWith('.gouv.fr');
  const isEducation =
    host.endsWith('.edu') || host.endsWith('.ac.uk') || host.includes('university');
  const isOfficialDocumentation = /(^|\.)docs\.|\/docs?\/|\/documentation\//.test(`${host}${path}`);
  const isCompanyReport = /investor|annual-report|earnings|financial-results/.test(path);

  let sourceType: SourceType = 'other';
  let trustTier: 1 | 2 | 3 | 4 | 5 = 3;
  if (isGovernment || [...tierOneHosts].some((known) => hasHost(host, known))) {
    sourceType =
      host.includes('statbel') || host.includes('eurostat') ? 'statistics' : 'government';
    trustTier = 1;
    if (host.includes('europa') || host.includes('eur-lex')) {
      sourceType = host.includes('eur-lex') ? 'regulation' : 'eu_institution';
    }
  } else if (isEducation) {
    sourceType = 'university';
    trustTier = 2;
  } else if (newsHosts.has(host) || [...newsHosts].some((known) => hasHost(host, known))) {
    sourceType = 'news';
    trustTier = 3;
  } else if (socialHosts.has(host) || [...socialHosts].some((known) => hasHost(host, known))) {
    sourceType = 'other';
    trustTier = 5;
  } else if (isOfficialDocumentation) {
    sourceType = 'documentation';
    trustTier = 4;
  } else if (isCompanyReport) {
    sourceType = 'company';
    trustTier = 4;
  }

  const isSubjectPreferred =
    (subject === 'belgian_statistics' &&
      (host.includes('statbel') || host.includes('nbb') || host.includes('eurostat'))) ||
    (subject === 'eu_regulation' && (host.includes('europa') || host.includes('eur-lex'))) ||
    (subject === 'scientific' && trustTier === 2) ||
    (subject === 'company_financials' && sourceType === 'company') ||
    (subject === 'product_documentation' && sourceType === 'documentation');

  return {
    ...source,
    sourceType,
    trustTier,
    score: (6 - trustTier) * 10 + (isSubjectPreferred ? 8 : 0),
  };
}

export function selectReliableSources(sources: RetrievedSource[], subject: ResearchSubject) {
  const seen = new Set<string>();
  return sources
    .map((source) => evaluateSource(source, subject))
    .filter((source) => {
      const canonical = canonicalSourceUrl(source.url);
      if (seen.has(canonical) || source.trustTier === 5) return false;
      seen.add(canonical);
      return true;
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 12);
}
