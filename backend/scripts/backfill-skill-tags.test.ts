import { describe, it, expect } from 'vitest';
import { parseBareSlug, parseYesNo, indicesMissingSkillSlug, formatSummaryTable } from './backfill-lib';

// M3a Task 9 — unit coverage for the backfill script's pure helpers (the AI/DB pipeline
// itself is exercised by the script's --dry-run and the manual sign-off real run).

const ALLOWED = new Set(['fraction-arithmetic', 'equivalent-fractions']);

describe('parseBareSlug', () => {
  it('accepts a bare slug', () =>
    expect(parseBareSlug('fraction-arithmetic', ALLOWED)).toBe('fraction-arithmetic'));

  it('accepts a slug with surrounding whitespace and trailing period', () =>
    expect(parseBareSlug('  fraction-arithmetic.\n', ALLOWED)).toBe('fraction-arithmetic'));

  it('accepts a quoted slug', () =>
    expect(parseBareSlug('"equivalent-fractions"', ALLOWED)).toBe('equivalent-fractions'));

  it('accepts a code-fenced slug', () =>
    expect(parseBareSlug('```\nfraction-arithmetic\n```', ALLOWED)).toBe('fraction-arithmetic'));

  it('accepts a JSON-object reply whose value validates', () =>
    expect(parseBareSlug('{"skillSlug": "fraction-arithmetic"}', ALLOWED)).toBe('fraction-arithmetic'));

  it('takes the first non-empty line of a multi-line reply', () =>
    expect(parseBareSlug('fraction-arithmetic\nBecause it adds fractions.', ALLOWED)).toBe('fraction-arithmetic'));

  it('rejects a slug outside the closed list', () =>
    expect(parseBareSlug('made-up-slug', ALLOWED)).toBeNull());

  it('rejects prose that does not contain a bare slug line', () =>
    expect(parseBareSlug('The best skill is fraction arithmetic', ALLOWED)).toBeNull());

  it('rejects an empty response', () => expect(parseBareSlug('', ALLOWED)).toBeNull());
});

describe('parseYesNo', () => {
  it('parses Y/y/Yes as true', () => {
    expect(parseYesNo('Y')).toBe(true);
    expect(parseYesNo('yes')).toBe(true);
    expect(parseYesNo('"Y"')).toBe(true);
  });

  it('parses N/no as false', () => {
    expect(parseYesNo('N')).toBe(false);
    expect(parseYesNo('no.')).toBe(false);
  });

  it('anything unclear is null, never yes', () => {
    expect(parseYesNo('')).toBeNull();
    expect(parseYesNo('maybe')).toBeNull();
    expect(parseYesNo('the tag fits')).toBeNull();
  });
});

describe('indicesMissingSkillSlug', () => {
  it('finds elements without a usable skillSlug', () => {
    const blob = [
      { questionText: 'a', skillSlug: 'fraction-arithmetic' },
      { questionText: 'b' },
      { questionText: 'c', skillSlug: '' },
      { questionText: 'd', skillSlug: 42 },
    ];
    expect(indicesMissingSkillSlug(blob)).toEqual([1, 2, 3]);
  });

  it('returns [] for a fully tagged blob', () =>
    expect(indicesMissingSkillSlug([{ skillSlug: 'x' }])).toEqual([]));

  it('returns [] for a non-array and skips non-object elements', () => {
    expect(indicesMissingSkillSlug('nope')).toEqual([]);
    expect(indicesMissingSkillSlug([null, 'str', { skillSlug: 'x' }])).toEqual([]);
  });
});

describe('formatSummaryTable', () => {
  it('renders sorted rows with a total', () => {
    const table = formatSummaryTable([
      { topic: 'time', slug: 'elapsed-time', count: 2 },
      { topic: 'fractions', slug: 'fraction-arithmetic', count: 3 },
    ]);
    const lines = table.split('\n');
    expect(lines[0]).toMatch(/Topic\s+Skill slug\s+Count/);
    expect(table.indexOf('fractions')).toBeLessThan(table.indexOf('time'));
    expect(lines[lines.length - 1]).toMatch(/Total\s+5/);
  });
});
