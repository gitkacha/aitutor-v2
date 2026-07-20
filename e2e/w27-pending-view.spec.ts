import { test, expect } from '@playwright/test';

// W-27: from the admin Pending Worksheets card (top of /admin), an unattempted worksheet's
// own content can be viewed inline — math questions/answers/explanations, or writing prompts.
// Runs as the seeded e2e admin.

test.use({ storageState: 'e2e/.auth/admin.json' });

// The Pending Worksheets section, scoped so its View buttons don't collide with the
// Saved Worksheets sections lower down the page.
function pendingSection(page: import('@playwright/test').Page) {
  return page.getByRole('main')
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Pending Worksheets' }) });
}

test.describe('W-27 — view pending worksheet content', () => {
  test('a pending math worksheet expands to show its questions, answers and explanations', async ({ page, request }) => {
    const stamp = Date.now();
    const title = `W27 math ${stamp}`;
    const save = await request.post('/api/math/worksheets/save', {
      data: {
        title, topicIds: ['arithmetic'],
        questions: [
          { questionText: `W27Q1 ${stamp}: what is 6 × 7?`, options: ['36', '42', '48', '54', '40'], correctIndex: 1, explanation: 'Six sevens are 42. The answer is Option B.', topicSlug: 'arithmetic' },
          { questionText: `W27Q2 ${stamp}: what is 81 ÷ 9?`, options: ['7', '8', '9', '10', '6'], correctIndex: 2, explanation: 'Nine nines are 81, so 81 ÷ 9 = 9. The answer is Option C.', topicSlug: 'arithmetic' },
        ],
      },
    });
    expect(save.status()).toBe(201);

    await page.goto('/admin');
    const section = pendingSection(page);
    const row = section.locator('div')
      .filter({ hasText: title })
      .filter({ has: page.getByRole('button', { name: /View/i }) })
      .last();
    await row.getByRole('button', { name: /View/i }).click();

    await expect(section.getByText(`W27Q1 ${stamp}: what is 6 × 7?`)).toBeVisible();
    await expect(section.getByText('Six sevens are 42.')).toBeVisible();
    await expect(section.getByText(`W27Q2 ${stamp}: what is 81 ÷ 9?`)).toBeVisible();
    await expect(section.getByText('42', { exact: true })).toBeVisible();
  });

  test('a pending writing worksheet expands to show its prompt', async ({ page, request }) => {
    const stamp = Date.now();
    const type = await (await request.get('/api/types/review')).json();
    const promptText = `W27 review prompt ${stamp}: review your favourite film.`;
    const save = await request.post('/api/worksheets/save', {
      data: { title: `W27 writing ${stamp}`, typeIds: [type.id], prompts: [promptText] },
    });
    expect(save.status()).toBe(201);

    await page.goto('/admin');
    const section = pendingSection(page);
    const row = section.locator('div')
      .filter({ hasText: `W27 writing ${stamp}` })
      .filter({ has: page.getByRole('button', { name: /View/i }) })
      .last();
    await row.getByRole('button', { name: /View/i }).click();
    await expect(section.getByText(promptText)).toBeVisible();
  });
});
