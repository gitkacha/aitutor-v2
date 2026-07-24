import { test, expect, request as pwRequest } from '@playwright/test';

// M3a Task 2: the 89-skill NSW Selective taxonomy is seeded (82 math skills across
// 20 topics + 7 writing skills) and exposed to admins at GET /api/skills.
test('skills are seeded: 20 math topic groups + 7 writing skills', async ({ baseURL }) => {
  const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
  const skills = await (await admin.get('/api/skills')).json();
  const math = skills.filter((s: any) => s.subject === 'math');
  const writing = skills.filter((s: any) => s.subject === 'writing');
  expect(new Set(math.map((s: any) => s.topicSlug)).size).toBe(20);
  expect(writing.map((s: any) => s.slug).sort()).toEqual(
    ['audience', 'cohesion', 'ideas', 'punctuation-grammar', 'sentence-variety', 'text-structure', 'vocabulary']);
  expect(math.find((s: any) => s.slug === 'faster-long-division')).toBeTruthy();
  for (const s of skills) { expect(s.description.length).toBeGreaterThan(10); expect(s.examLevelNotes.length).toBeGreaterThan(10); }
  await admin.dispose();
});
