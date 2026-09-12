import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Recharts' ResponsiveContainer needs ResizeObserver, absent in jsdom.
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

// W-124/W-125: the student lesson page is a segment-by-segment player (one ## section per card) with
// a gated Guided Quiz on the final card.
const get = vi.fn();
const complete = vi.fn();
vi.mock('@/lib/api', () => ({ coachingApi: { get: (...a: unknown[]) => get(...a), complete: (...a: unknown[]) => complete(...a) } }));

import Lesson, { referencesFigure, figureCarriedTo } from './Lesson';

const content = [
  '## 1. The Selective Trap',
  'Spot the TRAPMARKER question type.',
  '',
  '```figure',
  '{"kind":"pie-chart","title":"Money","sectors":[{"label":"A","percent":60,"showPercent":true},{"label":"B","percent":40}]}',
  '```',
  '',
  '## 2. The Intuitive Building Block',
  'Think in BUILDMARKER equal boxes.',
  '',
  '## 3. The Speed Shortcut',
  'SHORTMARKER: 24 x 5 = 120.',
  '',
  '## 4. Guided Quiz',
  'Your turn.',
  '```quiz',
  '{"question":"A slice is 25% = 30 people. Total?","hint":"one box is [___]","answer":"120","solution":"SOLUTIONMARKER 30 x 4 = 120"}',
  '```',
].join('\n');

beforeEach(() => {
  get.mockReset().mockResolvedValue({ id: 1, title: 'Pie Charts', content, status: 'approved', skill: { name: 'Pie Charts', slug: 'pie', topicId: 1 } });
  complete.mockReset().mockResolvedValue({ completedAt: new Date().toISOString() });
});

function renderLesson() {
  return render(
    <MemoryRouter initialEntries={['/lesson/1']}>
      <Routes><Route path="/lesson/:id" element={<Lesson />} /></Routes>
    </MemoryRouter>,
  );
}
const next = () => screen.getByRole('button', { name: /next/i });

describe('segmented lesson player', () => {
  it('shows one segment at a time — later segments are not rendered up front', async () => {
    renderLesson();
    expect(await screen.findByText(/TRAPMARKER/)).toBeTruthy();
    // A real figure renders on the first card.
    expect(screen.getByTestId('stimulus-pie-chart')).toBeTruthy();
    // Content from later segments must NOT be on the page yet.
    expect(screen.queryByText(/SHORTMARKER/)).toBeNull();
    expect(screen.queryByText(/SOLUTIONMARKER/)).toBeNull();
  });

  it('advances to the next segment on Next', async () => {
    renderLesson();
    await screen.findByText(/TRAPMARKER/);
    fireEvent.click(next());
    expect(await screen.findByText(/BUILDMARKER/)).toBeTruthy();
    expect(screen.queryByText(/TRAPMARKER/)).toBeNull();
  });

  it('carries the figure onto a card that references it — for a pie AND a non-pie figure (W-132)', async () => {
    const withFig = (fig: string) => [
      '## 1. The Selective Trap', 'Spot it.',
      '## 2. The Intuitive Building Block', 'Here it is.', fig,
      '## 3. The Speed Shortcut', 'Now look at the graph and the 15% slice to solve it.',
    ].join('\n');

    // Pie referenced on card 3 (which has no ```figure of its own).
    get.mockResolvedValue({ id: 1, title: 'L', status: 'approved', skill: { name: 'S', slug: 's', topicId: 1 },
      content: withFig('```figure\n{"kind":"pie-chart","title":"P","sectors":[{"label":"A","percent":60},{"label":"B","percent":40}]}\n```') });
    renderLesson();
    await screen.findByText(/Spot it/);
    fireEvent.click(next()); // Building Block (its own pie)
    fireEvent.click(next()); // Speed Shortcut (references it → carried pie)
    expect(await screen.findByText(/Now look at the graph/)).toBeTruthy();
    expect(screen.getByTestId('stimulus-pie-chart')).toBeTruthy();

    // Same behaviour for a bar-chart — proves it isn't pie-specific.
    get.mockResolvedValue({ id: 2, title: 'L2', status: 'approved', skill: { name: 'S', slug: 's', topicId: 1 },
      content: withFig('```figure\n{"kind":"bar-chart","title":"G","points":[{"x":"Mon","y":4},{"x":"Tue","y":8}]}\n```') });
    render(
      <MemoryRouter initialEntries={['/lesson/2']}>
        <Routes><Route path="/lesson/:id" element={<Lesson />} /></Routes>
      </MemoryRouter>,
    );
    await screen.findAllByText(/Spot it/);
    const nexts = screen.getAllByRole('button', { name: /next/i });
    fireEvent.click(nexts[nexts.length - 1]);
    const nexts2 = screen.getAllByRole('button', { name: /next/i });
    fireEvent.click(nexts2[nexts2.length - 1]);
    expect(await screen.findByTestId('stimulus-bar-chart')).toBeTruthy();
  });

  it('carries the figure onto the Guided Quiz card when the quiz references it (W-135)', async () => {
    const content = [
      '## 1. The Selective Trap', 'Spot it.',
      '## 2. The Intuitive Building Block', 'Here it is.',
      '```figure\n{"kind":"bar-chart","title":"Sales","points":[{"x":"Mon","y":4},{"x":"Tue","y":8}]}\n```',
      '## 3. Guided Quiz', 'Use the numbers below.',
      '```quiz\n{"question":"From the graph, what is Tuesday?","hint":"read the bar","answer":"8","solution":"It is 8."}\n```',
    ].join('\n');
    get.mockResolvedValue({ id: 3, title: 'L', status: 'approved', skill: { name: 'S', slug: 's', topicId: 1 }, content });
    renderLesson();
    await screen.findByText(/Spot it/);
    fireEvent.click(next()); // Building Block (its own bar chart)
    fireEvent.click(next()); // Guided Quiz — references "the graph"
    expect(await screen.findByText(/From the graph/)).toBeTruthy();
    // The bar chart is carried onto the quiz card even though it has no ```figure of its own.
    expect(screen.getByTestId('stimulus-bar-chart')).toBeTruthy();
  });

  it('referencesFigure / figureCarriedTo helpers', () => {
    expect(referencesFigure('look at the chart above')).toBe(true);
    expect(referencesFigure('the 15% slice of the pie')).toBe(true);
    expect(referencesFigure('read the graph / table / diagram')).toBe(true);
    expect(referencesFigure('just add the numbers, no visual needed here')).toBe(false);
    const cards = [
      { kind: 'idea' as const, heading: 'Trap', body: 'x' },
      { kind: 'steps' as const, heading: 'Block', body: 'y\n```figure\n{"kind":"pie-chart"}\n```' },
      { kind: 'trick' as const, heading: 'Shortcut', body: 'see the pie' },
    ];
    expect(figureCarriedTo(cards, 2)).toContain('pie-chart'); // nearest preceding figure
    expect(figureCarriedTo(cards, 1)).toBeNull(); // no figure before card 1
  });

  it('gates completion — Mark complete is disabled until the quiz is answered correctly', async () => {
    renderLesson();
    await screen.findByText(/TRAPMARKER/);
    fireEvent.click(next()); // -> Building Block
    fireEvent.click(next()); // -> Speed Shortcut
    fireEvent.click(next()); // -> Guided Quiz (final)

    const done = await screen.findByRole('button', { name: /mark (as )?complete/i });
    expect((done as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/your answer/i), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: /check/i }));

    await waitFor(() =>
      expect((screen.getByRole('button', { name: /mark (as )?complete/i }) as HTMLButtonElement).disabled).toBe(false),
    );
  });
});
