import { describe, it, expect } from 'vitest';
import prisma from '../lib/prisma';

// W-89 (Thinking Skills Phase 1, Task 1): MathTopic gains a `subject` column defaulting to 'math',
// so the existing MCQ stack becomes subject-aware without changing any Math behaviour. Existing
// seeded topics must read back as 'math' (SQLite backfills the ADD COLUMN default).
describe('MathTopic.subject', () => {
  it('a seeded math topic reads back with subject "math"', async () => {
    const topic = await prisma.mathTopic.findFirst({ where: { slug: 'algebra' } });
    expect(topic, 'the algebra topic is seeded').not.toBeNull();
    expect(topic!.subject).toBe('math');
  });
});
