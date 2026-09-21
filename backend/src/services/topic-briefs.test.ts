import { describe, it, expect } from 'vitest';
import { buildTopicBriefSection, TOPIC_BRIEFS } from './topic-briefs';

// W-146: a worksheet that is EXCLUSIVELY Data Interpretation should spread its questions roughly
// equally across the figure sub-types (pie / bar / line / table) rather than leaning on one.
const SUBTYPE_MARKER = 'SUB-TYPE BALANCE';
describe('data-interpretation sub-type balance (W-146)', () => {
  it('injects the sub-type balance instruction when the selection is exactly [data-interpretation]', () => {
    const text = buildTopicBriefSection(['data-interpretation']);
    expect(text).toContain(SUBTYPE_MARKER);
    const lower = text.toLowerCase();
    expect(lower).toContain('pie');
    expect(lower).toContain('bar');
    expect(lower).toContain('line');
    expect(lower).toContain('table');
  });

  it('does NOT inject it when Data Interpretation is mixed with another topic', () => {
    expect(buildTopicBriefSection(['data-interpretation', 'fractions'])).not.toContain(SUBTYPE_MARKER);
  });

  it('does NOT inject it for the protractor half of the shared Brief 1', () => {
    expect(buildTopicBriefSection(['protractor-skills'])).not.toContain(SUBTYPE_MARKER);
  });
});

describe('TOPIC_BRIEFS mapping', () => {
  it('maps the four briefs to their topic slugs', () => {
    expect(TOPIC_BRIEFS['data-interpretation'].title).toBe('Graph and scale reading');
    expect(TOPIC_BRIEFS['protractor-skills'].title).toBe('Graph and scale reading');
    expect(TOPIC_BRIEFS['time-zones'].title).toBe('Time zones and elapsed time');
    expect(TOPIC_BRIEFS['time'].title).toBe('Time zones and elapsed time');
    expect(TOPIC_BRIEFS['perimeter'].title).toBe('Composite and rearranged shapes');
    expect(TOPIC_BRIEFS['fractions'].title).toBe('Fractions of a remainder, ratio and ordering');
  });
});

describe('buildTopicBriefSection', () => {
  it('returns empty string when no selected topic is briefed', () => {
    expect(buildTopicBriefSection(['arithmetic', 'algebra'])).toBe('');
    expect(buildTopicBriefSection([])).toBe('');
  });

  it('includes the DISTRACTOR RULE and FIGURES rule and the topic common errors', () => {
    const text = buildTopicBriefSection(['data-interpretation']);
    expect(text).toContain('DISTRACTOR RULE');
    expect(text.toLowerCase()).toContain('four wrong options');
    expect(text).toContain('FIGURES');
    expect(text.toLowerCase()).toContain('avoid an interval of 1');
    expect(text).toContain('Graph and scale reading');
    expect(text.toLowerCase()).toContain('counting gridlines instead of the gaps');
  });

  it('emits each shared rule block exactly once even with two briefed topics selected', () => {
    const text = buildTopicBriefSection(['data-interpretation', 'protractor-skills', 'perimeter']);
    // data-interpretation + protractor-skills share ONE brief → its title appears once
    expect(text.match(/Graph and scale reading/g)!.length).toBe(1);
    expect(text.match(/Composite and rearranged shapes/g)!.length).toBe(1);
    expect(text.match(/DISTRACTOR RULE/g)!.length).toBe(1);
    expect(text.match(/^FIGURES/gm)!.length).toBe(1);
  });

  it('renders the question mix as per-10 proportional emphasis (no bare absolute counts)', () => {
    const text = buildTopicBriefSection(['time-zones']);
    expect(text.toLowerCase()).toContain('in roughly every 10 questions');
    expect(text.toLowerCase()).toContain('two-hop');
  });
});
