import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Phase B / B4 (W-108): Most Improved surfaces gains from BOTH Mathematics and Thinking Skills.
const math = vi.fn();
const thinkingSkills = vi.fn();
vi.mock('@/lib/api', () => ({ improvementsApi: { math: () => math(), thinkingSkills: () => thinkingSkills() } }));

import MostImproved from './MostImproved';

const topic = (slug: string, name: string) => ({
  slug, name, delta: { metric: 'accuracy' as const, value: 12 }, interventionId: null, skills: [],
});

beforeEach(() => {
  math.mockReset().mockResolvedValue({ topics: [topic('arithmetic', 'Arithmetic')] });
  thinkingSkills.mockReset().mockResolvedValue({ topics: [topic('visual-reasoning', 'Visual Reasoning')] });
});

describe('MostImproved', () => {
  it('shows improved topics from both Mathematics and Thinking Skills', async () => {
    render(<MostImproved />);
    expect(await screen.findByText('Arithmetic')).toBeTruthy();
    expect(await screen.findByText('Visual Reasoning')).toBeTruthy();
    expect(thinkingSkills).toHaveBeenCalled();
  });
});
