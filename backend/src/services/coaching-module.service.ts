import prisma from '../lib/prisma';
import { generateCoachingModuleContent } from './coaching.service';

// W-137: the SINGLE place a coaching-lesson DRAFT is generated and persisted, shared by the Admin UI
// generate button (routes/coaching.ts) and the coach chat (chat-tools `assign_coaching`). Keeping
// one function guarantees the two surfaces cannot drift — same content (via generateCoachingModule-
// Content), same persisted fields. `approach` is always 'tactical': the Standard/Tactical A/B was
// collapsed to the one tactical style (W-123), so the schema's 'standard' default must never leak in.
// (This mirrors the worksheet parity pattern where both surfaces share saveAndAssignWorksheet.)

export interface CoachingDraftSkill {
  id: number;
  name: string;
  slug: string;
  examLevelNotes: string;
  subject: string;
}

export async function generateAndSaveCoachingDraft(
  skill: CoachingDraftSkill,
  workspaceId: number,
): Promise<{ moduleId: number; verifierWarnings: string[] }> {
  // Coaching lessons exist for the MCQ subjects only; anything not thinking-skills generates as math.
  const gen = await generateCoachingModuleContent(
    { name: skill.name, slug: skill.slug, examLevelNotes: skill.examLevelNotes },
    skill.subject === 'thinking-skills' ? 'thinking-skills' : 'math',
  );
  const mod = await prisma.coachingModule.create({
    data: {
      workspaceId,
      skillId: skill.id,
      title: gen.title,
      content: gen.content,
      status: 'draft',
      approach: 'tactical',
    },
  });
  return { moduleId: mod.id, verifierWarnings: gen.verifierWarnings };
}
