import { test, expect, request as pwRequest } from '@playwright/test';

// W-91 (Thinking Skills, Task 3): the seed creates the 7 fixed sections (subject 'thinking-skills'),
// a skill per section, and exemplar bank questions per section (difficulty anchors from the PDFs).
const SECTIONS = [
  'finding-procedures',
  'evaluating-reasoning-errors',
  'logical-analysis',
  'visual-reasoning',
  'evaluating-evidence',
  'identifying-similarity',
  'relevant-selection',
];

test.describe('W-91 — Thinking Skills seed', () => {
  test('7 sections + 7 skills + exemplar questions per section', async ({ request, baseURL }) => {
    const topics = await (await request.get('/api/math/topics?subject=thinking-skills')).json();
    const slugs = topics.map((t: any) => t.slug).sort();
    expect(slugs).toEqual([...SECTIONS].sort());

    // Each section has at least one bank (practice) question, with 4 options.
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    for (const slug of SECTIONS) {
      const topic = await (await admin.get(`/api/math/topics/${slug}`)).json();
      expect(topic.questions.length, `${slug} has exemplar questions`).toBeGreaterThanOrEqual(1);
      const opts = JSON.parse(topic.questions[0].options);
      expect(opts.length, `${slug} questions are 4-option`).toBe(4);
    }

    // 7 thinking-skills skills exist, one per section (skills route is admin-only).
    const skills = await (await admin.get('/api/skills')).json();
    const tsSkills = skills.filter((s: any) => s.subject === 'thinking-skills');
    expect(tsSkills.map((s: any) => s.slug).sort()).toEqual([...SECTIONS].sort());
    await admin.dispose();
  });
});
