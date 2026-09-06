import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MarkdownView from './MarkdownView';
import { withFigures } from './lessonFigureComponents';

// Recharts' ResponsiveContainer uses ResizeObserver, which jsdom doesn't provide.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

// W-114: lesson markdown can embed a real figure via a ```figure fenced block. The lesson render
// sites pass `withFigures()` so those blocks become <StimulusFigure> (reusing the MCQ figure
// engine) instead of showing raw JSON. Malformed blocks fall back to a plain code block.

const pieLesson = [
  '## The idea',
  'Look at the biggest slice.',
  '',
  '```figure',
  '{"kind":"pie-chart","title":"Where Sam\'s money goes","sectors":[' +
    '{"label":"Rent","percent":50,"showPercent":true},' +
    '{"label":"Food","percent":30},' +
    '{"label":"Fun","percent":20}]}',
  '```',
].join('\n');

describe('lesson figure components', () => {
  it('renders a ```figure pie-chart block as a real StimulusFigure, not raw JSON', () => {
    const { container } = render(<MarkdownView content={pieLesson} components={withFigures()} />);
    // The figure engine wraps each figure in data-testid="stimulus-<kind>".
    expect(screen.getByTestId('stimulus-pie-chart')).toBeTruthy();
    expect(screen.getByText("Where Sam's money goes")).toBeTruthy();
    // The raw figure JSON must NOT leak into the rendered text.
    expect(container.textContent).not.toContain('"kind"');
    expect(container.textContent).not.toContain('sectors');
  });

  it('merges caller overrides with the figure overrides', () => {
    const merged = withFigures({ p: () => <p data-testid="custom-p">x</p> });
    expect(typeof merged.code).toBe('function');
    expect(typeof merged.p).toBe('function');
  });

  it('falls back to a code block for a malformed figure (no throw)', () => {
    const md = ['```figure', '{ not valid json', '```'].join('\n');
    const { container } = render(<MarkdownView content={md} components={withFigures()} />);
    expect(screen.queryByTestId('stimulus-pie-chart')).toBeNull();
    expect(container.textContent).toContain('not valid json');
  });
});
