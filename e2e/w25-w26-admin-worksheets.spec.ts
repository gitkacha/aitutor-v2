import { test, expect } from '@playwright/test';

// W-25: the admin can view a saved worksheet's own content (questions/answers/explanations,
// or writing prompts) — attempted or not. W-26: the question-count field accepts a directly
// typed number. Runs as the seeded e2e admin.

test.use({ storageState: 'e2e/.auth/admin.json' });

test.describe('W-25 — view saved worksheet content', () => {
  test('a saved math worksheet expands to show its questions, answers and explanations', async ({ page, request }) => {
    const stamp = Date.now();
    const title = `W25 math ${stamp}`;
    const save = await request.post('/api/math/worksheets/save', {
      data: {
        title, topicIds: ['arithmetic'],
        questions: [
          { questionText: `W25Q1 ${stamp}: what is 6 × 7?`, options: ['36', '42', '48', '54', '40'], correctIndex: 1, explanation: 'Six sevens are 42. The answer is Option B.', topicSlug: 'arithmetic', skillSlug: 'mental-multiplication-strategies' },
          { questionText: `W25Q2 ${stamp}: what is 81 ÷ 9?`, options: ['7', '8', '9', '10', '6'], correctIndex: 2, explanation: 'Nine nines are 81, so 81 ÷ 9 = 9. The answer is Option C.', topicSlug: 'arithmetic', skillSlug: 'faster-long-division' },
        ],
      },
    });
    expect(save.status()).toBe(201);

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Mathematics', exact: true }).click();
    const row = page.getByRole('main').locator('div')
      .filter({ hasText: title })
      .filter({ has: page.getByRole('button', { name: /View/i }) })
      .last();
    await row.getByRole('button', { name: /View/i }).click();

    await expect(page.getByText(`W25Q1 ${stamp}: what is 6 × 7?`)).toBeVisible();
    await expect(page.getByText('Six sevens are 42.')).toBeVisible();
    await expect(page.getByText(`W25Q2 ${stamp}: what is 81 ÷ 9?`)).toBeVisible();
    // The correct option is shown (read-only highlight).
    await expect(page.getByText('42', { exact: true })).toBeVisible();
  });

  test('a saved writing worksheet expands to show its prompt', async ({ page, request }) => {
    const stamp = Date.now();
    const type = await (await request.get('/api/types/review')).json();
    const promptText = `W25 review prompt ${stamp}: review your favourite book.`;
    const save = await request.post('/api/worksheets/save', {
      data: { title: `W25 writing ${stamp}`, typeIds: [type.id], prompts: [promptText] },
    });
    expect(save.status()).toBe(201);

    await page.goto('/admin'); // writing tab is default
    const row = page.getByRole('main').locator('div')
      .filter({ hasText: `W25 writing ${stamp}` })
      .filter({ has: page.getByRole('button', { name: /View/i }) })
      .last();
    await row.getByRole('button', { name: /View/i }).click();
    await expect(page.getByText(promptText)).toBeVisible();
  });
});

test.describe('W-26 — direct question-count entry', () => {
  test('typing a multi-digit count keeps the typed value', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Mathematics', exact: true }).click();
    const field = page.getByLabel('Number of questions');
    await field.click();
    await field.fill('');
    await field.pressSequentially('15');
    await expect(field).toHaveValue('15');
    await expect(page.getByRole('button', { name: /Generate 15-Question Worksheet/ })).toBeVisible();
  });
});
