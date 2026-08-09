import { describe, it, expect, vi, beforeEach } from 'vitest';

// W-85/W-86: the chat generate_worksheet action uses the SAME generation as the Admin UI (the shared
// `generateMathWorksheet` in ai.service), then SAVES the worksheet UNASSIGNED and returns a COMPACT
// result (no questions) so the full worksheet never bloats the chat transcript.
const { prismaMock, ai, wsService } = vi.hoisted(() => ({
  prismaMock: { skill: { findMany: vi.fn() } },
  ai: { generateMathWorksheet: vi.fn() },
  wsService: { saveAndAssignWorksheet: vi.fn() },
}));
vi.mock('../lib/prisma', () => ({ default: prismaMock }));
vi.mock('./ai.service', () => ({ generateMathWorksheet: ai.generateMathWorksheet }));
vi.mock('./math-worksheet.service', () => ({ saveAndAssignWorksheet: wsService.saveAndAssignWorksheet }));

import { executeActionTool, ACTION_TOOL_SCHEMAS, isActionTool } from './chat-tools';

const ctx = { workspaceId: 1, adminId: 2 };
const questions = [
  { questionText: 'Q1', options: ['a', 'b', 'c', 'd', 'e'], correctIndex: 1, explanation: 'x', topicSlug: 'directions', topicName: 'Directions', skillSlug: 'compass-directions' },
  { questionText: 'Q2', options: ['a', 'b', 'c', 'd', 'e'], correctIndex: 1, explanation: 'x', topicSlug: 'directions', topicName: 'Directions', skillSlug: 'compass-directions' },
];

beforeEach(() => {
  prismaMock.skill.findMany.mockReset().mockResolvedValue([]);
  ai.generateMathWorksheet.mockReset().mockResolvedValue({
    title: 'Directions practice',
    topics: [{ id: 17, name: 'Directions', slug: 'directions' }],
    questions,
  });
  wsService.saveAndAssignWorksheet.mockReset().mockResolvedValue({ id: 99, title: 'Directions practice' });
});

describe('generate_worksheet action (shared generation + save unassigned)', () => {
  it('save_and_assign_worksheet is not a chat tool; generate_worksheet is', () => {
    expect(isActionTool('generate_worksheet')).toBe(true);
    expect(isActionTool('save_and_assign_worksheet')).toBe(false);
    expect(ACTION_TOOL_SCHEMAS.map((t) => t.name)).not.toContain('save_and_assign_worksheet');
  });

  it('generates via the shared generateMathWorksheet, saves UNASSIGNED, returns a compact result', async () => {
    const result: any = await executeActionTool('generate_worksheet', { subject: 'math', topicSlugs: ['directions'], questionCount: 16 }, ctx);

    // Uses the exact same generator the Admin UI route uses.
    expect(ai.generateMathWorksheet).toHaveBeenCalledTimes(1);
    expect(ai.generateMathWorksheet).toHaveBeenCalledWith(['directions'], 16, ctx.workspaceId);

    // Saved with NO assignees.
    const saveArgs = wsService.saveAndAssignWorksheet.mock.calls[0][0];
    expect(saveArgs.assigneeIds).toEqual([]);
    expect(saveArgs.questions).toBe(questions);

    // Compact result — the reference, not the full questions.
    expect(result).toMatchObject({ saved: true, worksheetId: 99, questionCount: 2 });
    expect(result).not.toHaveProperty('questions');
  });

  it('resolves skillSlugs to their topics before generating', async () => {
    prismaMock.skill.findMany.mockResolvedValue([{ topic: { slug: 'directions' } }]);
    await executeActionTool('generate_worksheet', { subject: 'math', skillSlugs: ['compass-directions', 'turns-and-bearings'], questionCount: 16 }, ctx);
    expect(ai.generateMathWorksheet).toHaveBeenCalledWith(['directions'], 16, ctx.workspaceId);
  });
});
