import { describe, it, expect } from 'vitest';
import { mathWorksheetTitle } from '../lib/math-worksheet-title';

const topics = [
  { slug: 'fractions', name: 'Fractions' },
  { slug: 'speed-distance-time', name: 'Speed, Distance & Time' },
];

describe('mathWorksheetTitle (L10)', () => {
  it('uses topic names, not slugs', () => {
    expect(mathWorksheetTitle(['speed-distance-time'], topics)).toBe(
      'Worksheet: Speed, Distance & Time'
    );
    expect(mathWorksheetTitle(['fractions', 'speed-distance-time'], topics)).toBe(
      'Worksheet: Fractions, Speed, Distance & Time'
    );
  });

  it('labels an empty selection as All Topics', () => {
    expect(mathWorksheetTitle([], topics)).toBe('Worksheet: All Topics');
  });

  it('falls back to the slug when a topic is unknown', () => {
    expect(mathWorksheetTitle(['mystery-topic'], topics)).toBe('Worksheet: mystery-topic');
  });
});
