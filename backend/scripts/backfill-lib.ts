// M3a Task 9 — pure helpers for scripts/backfill-skill-tags.ts, extracted so they can be
// unit-tested (backfill-skill-tags.test.ts) without importing the script's side effects
// (dotenv, Prisma, the AI service).

// The tagging call is instructed to answer with a bare slug on one line. Models still
// occasionally wrap it (quotes, backticks, code fences, a JSON object, a trailing period),
// so parsing is tolerant of wrappers — but the final word must validate against the
// topic's closed skill list or the response is rejected (null).
export function parseBareSlug(content: string, allowedSlugs: Set<string>): string | null {
  let text = content.trim();
  // Strip code fences.
  text = text.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
  // A JSON-object reply like {"skillSlug": "x"} — accept any string value that validates.
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      for (const v of Object.values(parsed)) {
        if (typeof v === 'string' && allowedSlugs.has(v.trim())) return v.trim();
      }
    } catch {
      // fall through to line parsing
    }
  }
  // First non-empty line, unquoted, no trailing punctuation.
  const line = text.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? '';
  const cleaned = line.replace(/^["'`]+|["'`.,;]+$/g, '').trim();
  return allowedSlugs.has(cleaned) ? cleaned : null;
}

// The confirm call is instructed to answer with only Y or N. Anything that doesn't clearly
// start with one of those (after stripping wrappers) is null — treated as a failure by the
// caller, never as a yes.
export function parseYesNo(content: string): boolean | null {
  const cleaned = content.trim().replace(/^["'`]+/, '').toUpperCase();
  if (cleaned.startsWith('Y')) return true;
  if (cleaned.startsWith('N')) return false;
  return null;
}

// Indices of worksheet-blob elements that lack a usable skillSlug. Non-object elements are
// skipped (they can't be stamped); a non-array blob has nothing to report.
export function indicesMissingSkillSlug(json: unknown): number[] {
  if (!Array.isArray(json)) return [];
  const missing: number[] = [];
  json.forEach((q, i) => {
    if (q && typeof q === 'object' && !(typeof q.skillSlug === 'string' && q.skillSlug.length > 0)) {
      missing.push(i);
    }
  });
  return missing;
}

export interface SummaryRow {
  topic: string;
  slug: string;
  count: number;
}

// topic → slug → count, rendered as a plain aligned table (no table library for a script).
export function formatSummaryTable(rows: SummaryRow[]): string {
  const header: [string, string, string] = ['Topic', 'Skill slug', 'Count'];
  const sorted = [...rows].sort((a, b) => a.topic.localeCompare(b.topic) || a.slug.localeCompare(b.slug));
  const topicW = Math.max(header[0].length, ...sorted.map((r) => r.topic.length));
  const slugW = Math.max(header[1].length, ...sorted.map((r) => r.slug.length));
  const lines = [
    `${header[0].padEnd(topicW)}  ${header[1].padEnd(slugW)}  ${header[2]}`,
    '-'.repeat(topicW + slugW + 9),
    ...sorted.map((r) => `${r.topic.padEnd(topicW)}  ${r.slug.padEnd(slugW)}  ${String(r.count).padStart(5)}`),
  ];
  const total = sorted.reduce((a, r) => a + r.count, 0);
  lines.push('-'.repeat(topicW + slugW + 9));
  lines.push(`${'Total'.padEnd(topicW)}  ${''.padEnd(slugW)}  ${String(total).padStart(5)}`);
  return lines.join('\n');
}
