import { describe, it, expect, vi, beforeEach } from 'vitest';

// Phase A / A2 (W-101): on-demand self-serve practice for Thinking Skills. The service generates via
// the SHARED generateMathWorksheet, then persists an UNASSIGNED `kind:"self-practice"` worksheet
// owned by the student (so the attempt/review can reference real question IDs), and returns its id.
// It refuses non-Thinking-Skills topics (Mathematics keeps its bank-based practice).
const { prismaMock, ai, wsService } = vi.hoisted(() => ({
  prismaMock: { mathTopic: { findUnique: vi.fn() } },
  ai: { generateMathWorksheet: vi.fn() },
  wsService: { saveAndAssignWorksheet: vi.fn() },
}));
vi.mock('../lib/prisma', () => ({ default: prismaMock }));
vi.mock('../services/ai.service', () => ({ generateMathWorksheet: ai.generateMathWorksheet }));
vi.mock('../services/math-worksheet.service', () => ({ saveAndAssignWorksheet: wsService.saveAndAssignWorksheet }));

import { generateSelfPracticeWorksheet, PRACTICE_QUESTION_COUNT } from '../services/math-practice.service';

const tsQuestions = [
  { questionText: 'Q1', options: ['a', 'b', 'c', 'd'], correctIndex: 0, explanation: 'Therefore, the answer is Option A.', topicSlug: 'visual-reasoning', topicName: 'Visual Reasoning', skillSlug: 'visual-reasoning' },
];

beforeEach(() => {
  prismaMock.mathTopic.findUnique.mockReset();
  ai.generateMathWorksheet.mockReset().mockResolvedValue({
    title: 'gen', topics: [{ id: 5, name: 'Visual Reasoning', slug: 'visual-reasoning' }], questions: tsQuestions,
  });
  wsService.saveAndAssignWorksheet.mockReset().mockResolvedValue({ id: 77, title: 'Practice: Visual Reasoning' });
});

describe('generateSelfPracticeWorksheet', () => {
  it('generates via the shared engine and saves an UNASSIGNED self-practice worksheet owned by the student', async () => {
    prismaMock.mathTopic.findUnique.mockResolvedValue({ id: 5, slug: 'visual-reasoning', name: 'Visual Reasoning', subject: 'thinking-skills' });

    const result = await generateSelfPracticeWorksheet({ topicSlug: 'visual-reasoning', workspaceId: 1, studentId: 42 });

    expect(ai.generateMathWorksheet).toHaveBeenCalledWith(['visual-reasoning'], PRACTICE_QUESTION_COUNT, 1);
    const saveArgs = wsService.saveAndAssignWorksheet.mock.calls[0][0];
    expect(saveArgs.kind).toBe('self-practice');
    expect(saveArgs.assigneeIds).toEqual([]);
    expect(saveArgs.createdById).toBe(42);
    expect(saveArgs.questions).toBe(tsQuestions);
    expect(result).toEqual({ worksheetId: 77 });
  });

  it('refuses a Mathematics topic (bank-based practice is unchanged)', async () => {
    prismaMock.mathTopic.findUnique.mockResolvedValue({ id: 1, slug: 'arithmetic', name: 'Arithmetic', subject: 'math' });
    await expect(generateSelfPracticeWorksheet({ topicSlug: 'arithmetic', workspaceId: 1, studentId: 42 }))
      .rejects.toThrow(/Thinking Skills/);
    expect(ai.generateMathWorksheet).not.toHaveBeenCalled();
  });

  it('404s an unknown topic', async () => {
    prismaMock.mathTopic.findUnique.mockResolvedValue(null);
    await expect(generateSelfPracticeWorksheet({ topicSlug: 'nope', workspaceId: 1, studentId: 42 }))
      .rejects.toThrow(/not found/i);
  });
});
