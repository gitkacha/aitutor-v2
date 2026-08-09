import { describe, it, expect, vi, beforeEach } from 'vitest';

// W-85 Part A: the chat generate_worksheet action now GENERATES and SAVES the worksheet to the
// workspace UNASSIGNED, returning a COMPACT result (no questions) so the full worksheet never
// bloats the chat transcript (which was causing the empty-response fallback).
const { prismaMock, ai, wsService } = vi.hoisted(() => ({
  prismaMock: { skill: { findMany: vi.fn() } },
  ai: { resolveMathTopicsForGeneration: vi.fn(), generateMathWorksheetQuestions: vi.fn() },
  wsService: { saveAndAssignWorksheet: vi.fn(), validateWorksheetQuestions: vi.fn() },
}));
vi.mock('../lib/prisma', () => ({ default: prismaMock }));
vi.mock('./ai.service', () => ({
  resolveMathTopicsForGeneration: ai.resolveMathTopicsForGeneration,
  generateMathWorksheetQuestions: ai.generateMathWorksheetQuestions,
}));
vi.mock('./math-worksheet.service', () => ({
  saveAndAssignWorksheet: wsService.saveAndAssignWorksheet,
  validateWorksheetQuestions: wsService.validateWorksheetQuestions,
}));

import { executeActionTool, ACTION_TOOL_SCHEMAS, isActionTool } from './chat-tools';

const ctx = { workspaceId: 1, adminId: 2 };
const questions = [
  { questionText: 'Q1', options: ['a', 'b', 'c', 'd', 'e'], correctIndex: 1, explanation: 'x', topicSlug: 'directions', topicName: 'Directions', skillSlug: 'compass-directions' },
  { questionText: 'Q2', options: ['a', 'b', 'c', 'd', 'e'], correctIndex: 1, explanation: 'x', topicSlug: 'directions', topicName: 'Directions', skillSlug: 'compass-directions' },
];

beforeEach(() => {
  prismaMock.skill.findMany.mockReset().mockResolvedValue([]);
  ai.resolveMathTopicsForGeneration.mockReset().mockResolvedValue([{ id: 17, name: 'Directions', slug: 'directions' }]);
  ai.generateMathWorksheetQuestions.mockReset().mockResolvedValue(questions);
  wsService.saveAndAssignWorksheet.mockReset().mockResolvedValue({ id: 99, title: 'Directions practice' });
});

describe('generate_worksheet action (generate + save unassigned)', () => {
  it('save_and_assign_worksheet is no longer a chat tool; generate_worksheet still is', () => {
    expect(isActionTool('generate_worksheet')).toBe(true);
    expect(isActionTool('save_and_assign_worksheet')).toBe(false);
    expect(ACTION_TOOL_SCHEMAS.map((t) => t.name)).not.toContain('save_and_assign_worksheet');
  });

  it('generates, saves UNASSIGNED, and returns a compact result (no questions)', async () => {
    const result: any = await executeActionTool('generate_worksheet', { subject: 'math', topicSlugs: ['directions'], questionCount: 16 }, ctx);

    expect(ai.generateMathWorksheetQuestions).toHaveBeenCalledTimes(1);
    // Saved to the workspace with NO assignees.
    expect(wsService.saveAndAssignWorksheet).toHaveBeenCalledTimes(1);
    const saveArgs = wsService.saveAndAssignWorksheet.mock.calls[0][0];
    expect(saveArgs.assigneeIds).toEqual([]);
    expect(saveArgs.questions).toBe(questions);
    expect(saveArgs.workspaceId).toBe(ctx.workspaceId);

    // Compact result — the worksheet reference, NOT the full questions.
    expect(result).toMatchObject({ saved: true, worksheetId: 99, questionCount: 2 });
    expect(result).not.toHaveProperty('questions');
  });
});
