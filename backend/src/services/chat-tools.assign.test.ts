import { describe, it, expect, vi, beforeEach } from 'vitest';

// M3c Phase 2a (W-65): the assign_coaching action-tool executor. Two branches:
//  - no approved module for the skill → generate a DRAFT (needs approval), do NOT assign;
//  - an approved module exists → upsert a CoachingAssignment (idempotent on @@unique).
// prisma and the (judgment-authored) generation service are stubbed so we test the control flow.

const { prismaMock, generateCoachingModuleContent } = vi.hoisted(() => ({
  prismaMock: {
    skill: { findFirst: vi.fn() },
    user: { findFirst: vi.fn() },
    coachingModule: { findFirst: vi.fn(), create: vi.fn() },
    coachingAssignment: { upsert: vi.fn() },
  },
  generateCoachingModuleContent: vi.fn(),
}));
vi.mock('../lib/prisma', () => ({ default: prismaMock }));
vi.mock('./coaching.service', () => ({ generateCoachingModuleContent }));

import { executeActionTool, ACTION_TOOL_SCHEMAS, isActionTool } from './chat-tools';

const ctx = { workspaceId: 1, adminId: 2 };
const skill = { id: 7, name: 'Balancing Number Sentences', slug: 'balancing-number-sentences', examLevelNotes: 'notes', subject: 'math' };

beforeEach(() => {
  for (const m of Object.values(prismaMock)) for (const fn of Object.values(m)) (fn as any).mockReset();
  generateCoachingModuleContent.mockReset();
  prismaMock.skill.findFirst.mockResolvedValue(skill);
  prismaMock.user.findFirst.mockResolvedValue({ id: 42, workspaceId: 1 }); // assertStudentInWorkspace
});

describe('assign_coaching action tool', () => {
  it('is a registered, confirmation-gated action tool', () => {
    expect(isActionTool('assign_coaching')).toBe(true);
    const schema = ACTION_TOOL_SCHEMAS.find((t) => t.name === 'assign_coaching');
    expect(schema).toBeTruthy();
    expect((schema!.parameters as any).required).toEqual(expect.arrayContaining(['studentId', 'skillSlug']));
  });

  it('generates a draft (needs approval) and does NOT assign when no approved module exists', async () => {
    prismaMock.coachingModule.findFirst.mockResolvedValue(null);
    generateCoachingModuleContent.mockResolvedValue({ title: skill.name, content: '## The idea', verifierWarnings: [] });
    prismaMock.coachingModule.create.mockResolvedValue({ id: 10 });

    const result: any = await executeActionTool('assign_coaching', { studentId: 42, skillSlug: skill.slug }, ctx);

    expect(generateCoachingModuleContent).toHaveBeenCalledTimes(1);
    expect(prismaMock.coachingModule.create).toHaveBeenCalledTimes(1);
    // W-137: the chat draft must be persisted EXACTLY as the Admin UI persists it — a tactical
    // draft (never the W-123-obsolete 'standard' default the schema falls back to).
    expect(prismaMock.coachingModule.create.mock.calls[0][0].data).toMatchObject({
      workspaceId: 1, skillId: skill.id, status: 'draft', approach: 'tactical',
    });
    expect(prismaMock.coachingAssignment.upsert).not.toHaveBeenCalled();
    expect(result).toMatchObject({ generatedDraft: true, needsApproval: true, moduleId: 10 });
  });

  it('upserts an assignment (no generation) when an approved module exists', async () => {
    prismaMock.coachingModule.findFirst.mockResolvedValue({ id: 5, status: 'approved' });
    prismaMock.coachingAssignment.upsert.mockResolvedValue({ id: 99 });

    const result: any = await executeActionTool('assign_coaching', { studentId: 42, skillSlug: skill.slug, interventionId: 3 }, ctx);

    expect(generateCoachingModuleContent).not.toHaveBeenCalled();
    expect(prismaMock.coachingModule.create).not.toHaveBeenCalled();
    expect(prismaMock.coachingAssignment.upsert).toHaveBeenCalledTimes(1);
    const call = prismaMock.coachingAssignment.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ moduleId_studentId: { moduleId: 5, studentId: 42 } });
    expect(call.create).toMatchObject({ moduleId: 5, studentId: 42, interventionId: 3 });
    expect(result).toMatchObject({ assigned: true, moduleId: 5, assignmentId: 99 });
  });

  it('throws when the skill is not a known math skill', async () => {
    prismaMock.skill.findFirst.mockResolvedValue(null);
    await expect(executeActionTool('assign_coaching', { studentId: 42, skillSlug: 'nope' }, ctx)).rejects.toThrow();
  });
});
