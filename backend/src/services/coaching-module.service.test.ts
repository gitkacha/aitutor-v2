import { describe, it, expect, vi, beforeEach } from 'vitest';

// W-137: the shared draft generator used by BOTH the Admin UI route and the coach chat. We pin the
// two things that keep the surfaces from diverging: it always persists a `tactical` draft (never the
// schema's 'standard' default), and it routes the subject to the right generation prompt.

const { prismaMock, generateCoachingModuleContent } = vi.hoisted(() => ({
  prismaMock: { coachingModule: { create: vi.fn() } },
  generateCoachingModuleContent: vi.fn(),
}));
vi.mock('../lib/prisma', () => ({ default: prismaMock }));
vi.mock('./coaching.service', () => ({ generateCoachingModuleContent }));

import { generateAndSaveCoachingDraft } from './coaching-module.service';

const mathSkill = { id: 7, name: 'Balancing Number Sentences', slug: 'balancing-number-sentences', examLevelNotes: 'notes', subject: 'math' };

beforeEach(() => {
  prismaMock.coachingModule.create.mockReset();
  generateCoachingModuleContent.mockReset();
  generateCoachingModuleContent.mockResolvedValue({ title: mathSkill.name, content: '## The idea', verifierWarnings: ['w1'] });
  prismaMock.coachingModule.create.mockResolvedValue({ id: 10 });
});

describe('generateAndSaveCoachingDraft', () => {
  it('persists a tactical draft (never the schema default) and returns a compact reference', async () => {
    const result = await generateAndSaveCoachingDraft(mathSkill, 1);

    expect(generateCoachingModuleContent).toHaveBeenCalledWith(
      { name: mathSkill.name, slug: mathSkill.slug, examLevelNotes: mathSkill.examLevelNotes },
      'math',
    );
    expect(prismaMock.coachingModule.create.mock.calls[0][0].data).toMatchObject({
      workspaceId: 1, skillId: 7, title: mathSkill.name, content: '## The idea', status: 'draft', approach: 'tactical',
    });
    expect(result).toEqual({ moduleId: 10, verifierWarnings: ['w1'] });
  });

  it('routes a thinking-skills skill to the thinking-skills generation prompt', async () => {
    await generateAndSaveCoachingDraft({ ...mathSkill, subject: 'thinking-skills' }, 1);
    expect(generateCoachingModuleContent).toHaveBeenCalledWith(expect.anything(), 'thinking-skills');
  });
});
