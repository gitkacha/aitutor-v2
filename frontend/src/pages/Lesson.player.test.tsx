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

import Lesson from './Lesson';

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
