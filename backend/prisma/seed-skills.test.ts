import { describe, it, expect, vi } from 'vitest';
import { ensureSkillsSeeded } from './seed-skills';

// W-41: the backend must guarantee the skill taxonomy exists on boot, so a long-lived or
// freshly-cloned DB can't run with an empty Skill table (the gap that left dev.db untagged).
// ensureSkillsSeeded seeds iff the table is empty, and is idempotent. The guard is tested
// with an injected seed function + a stub prisma so the fast unit suite needs no live DB;
// real-DB seeding is proven separately (the m3a-skills-seed e2e + a scratch-DB boot check).

describe('ensureSkillsSeeded', () => {
  it('seeds when the Skill table is empty, and reports it seeded', async () => {
    const seedImpl = vi.fn().mockResolvedValue(undefined);
    const prisma = { skill: { count: vi.fn().mockResolvedValue(0) } } as any;

    const seeded = await ensureSkillsSeeded(prisma, seedImpl);

    expect(seeded).toBe(true);
    expect(seedImpl).toHaveBeenCalledOnce();
    expect(seedImpl).toHaveBeenCalledWith(prisma);
  });

  it('does nothing when the Skill table is already populated', async () => {
    const seedImpl = vi.fn().mockResolvedValue(undefined);
    const prisma = { skill: { count: vi.fn().mockResolvedValue(89) } } as any;

    const seeded = await ensureSkillsSeeded(prisma, seedImpl);

    expect(seeded).toBe(false);
    expect(seedImpl).not.toHaveBeenCalled();
  });
});
