// backend/src/__tests__/types.test.ts
import { describe, it, expect } from 'vitest';
import prisma from '../lib/prisma';

describe('WritingType CRUD', () => {
  it('should read seeded writing types', async () => {
    const types = await prisma.writingType.findMany();
    expect(types.length).toBeGreaterThanOrEqual(11);
    expect(types.map(t => t.slug)).toContain('persuasive');
    expect(types.map(t => t.slug)).toContain('narrative-creative');
  });

  it('should find a writing type by slug', async () => {
    const type = await prisma.writingType.findUnique({ where: { slug: 'persuasive' } });
    expect(type).not.toBeNull();
    expect(type!.name).toBe('Persuasive');
  });

  it('should include prompts when querying a type', async () => {
    const type = await prisma.writingType.findUnique({
      where: { slug: 'narrative-creative' },
      include: { prompts: true },
    });
    expect(type?.prompts.length).toBeGreaterThanOrEqual(5);
  });

  it('should create a new prompt for a type', async () => {
    const type = await prisma.writingType.findUnique({ where: { slug: 'letter' } });
    const prompt = await prisma.prompt.create({
      data: { text: 'Test prompt', typeId: type!.id },
    });
    expect(prompt.id).toBeGreaterThan(0);
    await prisma.prompt.delete({ where: { id: prompt.id } });
  });
});