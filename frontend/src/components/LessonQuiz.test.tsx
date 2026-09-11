import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MarkdownView from './MarkdownView';
import { withFigures } from './lessonFigureComponents';

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
