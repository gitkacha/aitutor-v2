import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MarkdownView from './MarkdownView';
import { withFigures } from './lessonFigureComponents';
import { parseQuiz } from './LessonQuiz';

// Recharts' ResponsiveContainer needs ResizeObserver, which jsdom lacks.
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

// W-120: a ```quiz block renders an interactive question — the worked solution stays hidden until the
// student answers correctly or clicks "Show me".
const quizMd = [
  '## 4. Guided Quiz',
  '',
  '```quiz',
  '{"question":"How many more books in Feb than Jan?","hint":"Write them side by side: [___] [___], then subtract.","answer":"20","acceptable":["20 books"],"solution":"Box 60 and 40, subtract: SIXTYMINUSFORTY equals twenty."}',
  '```',
].join('\n');

function renderQuiz() {
  return render(<MarkdownView content={quizMd} components={withFigures()} />);
}

describe('LessonQuiz', () => {
  it('shows the question + hint but hides the solution initially', () => {
    renderQuiz();
    expect(screen.getByText(/How many more books/)).toBeTruthy();
    expect(screen.getByText(/Write them side by side/)).toBeTruthy();
    // The solution marker must NOT be visible before answering.
    expect(screen.queryByText(/SIXTYMINUSFORTY/)).toBeNull();
    // Raw JSON must not leak.
    expect(screen.queryByText(/"question"/)).toBeNull();
  });

  it('reveals the solution on a correct answer', () => {
    renderQuiz();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '20 books' } });
    fireEvent.click(screen.getByRole('button', { name: /check/i }));
    expect(screen.getByText(/SIXTYMINUSFORTY/)).toBeTruthy();
  });

  it('shows try-again on a wrong answer and keeps the solution hidden', () => {
    renderQuiz();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: /check/i }));
    expect(screen.getByText(/try again/i)).toBeTruthy();
    expect(screen.queryByText(/SIXTYMINUSFORTY/)).toBeNull();
  });

  it('reveals the solution when the student clicks "Show me"', () => {
    renderQuiz();
    fireEvent.click(screen.getByRole('button', { name: /show me/i }));
    expect(screen.getByText(/SIXTYMINUSFORTY/)).toBeTruthy();
  });
});

describe('per-question quiz figure (W-136)', () => {
  const withFig = [
    '## 4. Guided Quiz',
    '```quiz',
    '{"question":"On this pie, what percent is Bus?","hint":"read the slice","answer":"25","solution":"25%",' +
      '"figure":{"kind":"pie-chart","title":"Travel","sectors":[{"label":"Car","percent":40},{"label":"Bus","percent":25},{"label":"Train","percent":35}]}}',
    '```',
  ].join('\n');

  it('parses and renders a figure INSIDE the question', () => {
    expect(
      parseQuiz('{"question":"q","answer":"1","figure":{"kind":"pie-chart","sectors":[{"label":"A","percent":60},{"label":"B","percent":40}]}}')?.figure,
    ).toBeTruthy();
    const { container } = render(<MarkdownView content={withFig} components={withFigures()} />);
    expect(screen.getByText(/On this pie, what percent is Bus/)).toBeTruthy();
    expect(container.querySelector('[data-testid="stimulus-pie-chart"]')).not.toBeNull();
  });

  it('ignores a malformed figure but still renders the question', () => {
    const q = parseQuiz('{"question":"q","answer":"1","figure":{"kind":"not-a-figure"}}');
    expect(q).not.toBeNull();
    expect(q?.figure).toBeUndefined();
  });
});
