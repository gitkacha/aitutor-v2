import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase B / B1 (W-105): the analytics adapter must scope skill signals by subject — Thinking Skills
// attempts share the MathAttempt table, so without a subject filter TS skills leak into the "math"
// report. The pure stats core is unchanged; only the adapter gains subject-awareness.
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    mathAttempt: { findMany: vi.fn() },
    mathQuestion: { findMany: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn() },
  },
}));
vi.mock('../lib/prisma', () => ({ default: prismaMock }));

import { getStudentSkillReport } from '../services/analytics.service';

const mathQ = {
  id: 1, skillId: 10, correctIndex: 0, options: JSON.stringify(['a', 'b', 'c', 'd', 'e']),
  skill: { slug: 'mental-addition-subtraction', name: 'Mental +/-', subject: 'math' },
  topic: { subject: 'math' },
};
const tsQ = {
  id: 2, skillId: 20, correctIndex: 0, options: JSON.stringify(['a', 'b', 'c', 'd']),
  skill: { slug: 'visual-reasoning', name: 'Visual Reasoning', subject: 'thinking-skills' },
  topic: { subject: 'thinking-skills' },
};
const A_math = { id: 101, finishedAt: new Date('2026-09-01T10:00:00Z'), questions: '[1]', answers: '[0]', questionTimings: '{"1":1000}', questionFlags: '[]', answerChanges: '{}' };
const A_ts = { id: 102, finishedAt: new Date('2026-09-02T10:00:00Z'), questions: '[2]', answers: '[0]', questionTimings: '{"2":1000}', questionFlags: '[]', answerChanges: '{}' };

beforeEach(() => {
  prismaMock.mathAttempt.findMany.mockReset().mockResolvedValue([A_ts, A_math]); // desc by finishedAt
  prismaMock.mathQuestion.findMany.mockReset().mockResolvedValue([mathQ, tsQ]);
  prismaMock.user.findUnique.mockReset().mockResolvedValue({ id: 1, workspaceId: 1 });
  prismaMock.user.findMany.mockReset().mockResolvedValue([{ id: 1 }]); // single-student cohort
});

describe('getStudentSkillReport subject scoping', () => {
  it('math report contains only math skills (no Thinking Skills leakage)', async () => {
    const report = await getStudentSkillReport(1, 'math');
    const slugs = report.skills.map((s: any) => s.slug);
    expect(slugs).toContain('mental-addition-subtraction');
    expect(slugs).not.toContain('visual-reasoning');
    expect(report.window.tests).toBe(1); // windowed to the one math attempt
  });

  it('thinking-skills report contains only Thinking Skills skills', async () => {
    const report = await getStudentSkillReport(1, 'thinking-skills');
    const slugs = report.skills.map((s: any) => s.slug);
    expect(slugs).toContain('visual-reasoning');
    expect(slugs).not.toContain('mental-addition-subtraction');
    expect(report.window.tests).toBe(1); // windowed to the one TS attempt
  });
});
