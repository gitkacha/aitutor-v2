import { test, expect, APIRequestContext, Page } from '@playwright/test';
import { startTest } from './helpers/practice';

// C2 + C3: a saved math worksheet must show its real answer options to the student (C3),
// and the attempt must be scored against the worksheet's own questions, with the review
// page showing those same questions (C2).

const WORKSHEET_QUESTIONS = [
  {
    questionText: 'What is 12 + 13?',
    options: ['20', '25', '30', '35', '40'],
    correctIndex: 1,
    explanation: '12 + 13 = 25. Therefore, the answer is Option B.',
    topicSlug: 'arithmetic',
    topicName: 'Arithmetic',
  },
  {
    questionText: 'What is 6 × 7?',
    options: ['36', '40', '42', '48', '54'],
    correctIndex: 2,
    explanation: '6 × 7 = 42. Therefore, the answer is Option C.',
    topicSlug: 'arithmetic',
    topicName: 'Arithmetic',
  },
  {
    questionText: 'What is 100 − 58?',
    options: ['32', '38', '42', '48', '52'],
    correctIndex: 2,
    explanation: '100 − 58 = 42. Therefore, the answer is Option C.',
    topicSlug: 'arithmetic',
    topicName: 'Arithmetic',
  },
];

async function saveWorksheet(request: APIRequestContext, title: string) {
  const res = await request.post('/api/math/worksheets/save', {
    data: { title, topicIds: ['arithmetic'], questions: WORKSHEET_QUESTIONS },
  });
  expect(res.status()).toBe(201);
  return res.json();
}

async function startWorksheet(page: Page, title: string) {
  await page.goto('/math/arithmetic');
  await page
    .locator('div')
    .filter({ hasText: title })
    .getByRole('button', { name: 'Start', exact: true })
    .last()
    .click();
  await startTest(page);
  await expect(page.getByText(/^\d+ \/ 3$/)).toBeVisible();
}

// Milestone 2 B1: these flows create worksheets / load demo data — admin-only routes.
test.use({ storageState: 'e2e/.auth/admin.json' });

test.describe('C2/C3 — math worksheet flow', () => {
  test('C3: worksheet questions show their real answer options', async ({ page, request }) => {
    const title = `E2E Worksheet C3 ${Date.now()}`;
    await saveWorksheet(request, title);
    await startWorksheet(page, title);

    await expect(page.getByText('What is 12 + 13?')).toBeVisible();
    // The five real options must be rendered — not placeholder letters.
    for (const opt of WORKSHEET_QUESTIONS[0].options) {
      await expect(page.getByRole('button', { name: new RegExp(`\\b${opt}\\b`) })).toBeVisible();
    }
  });

  test('C2: answering every worksheet question correctly scores 100% and reviews the right questions', async ({ page, request }) => {
    const title = `E2E Worksheet C2 ${Date.now()}`;
    await saveWorksheet(request, title);
    await startWorksheet(page, title);

    // Answer each question by clicking the option button at the known-correct position.
    for (let i = 0; i < WORKSHEET_QUESTIONS.length; i++) {
      const q = WORKSHEET_QUESTIONS[i];
      // Option buttons carry the A–E badge; click by position within the option list.
      const optionButtons = page.locator('button', { has: page.locator('span', { hasText: /^[A-E]$/ }) });
      await optionButtons.nth(q.correctIndex).click();
      if (i < WORKSHEET_QUESTIONS.length - 1) {
        await page.getByRole('button', { name: 'Next' }).click();
      } else {
        await page.getByRole('button', { name: 'Finish Test' }).click();
        await page.getByRole('button', { name: 'Submit Now' }).click();
      }
    }

    // Review page must reflect THIS worksheet: perfect score and its own questions.
    await expect(page).toHaveURL(/\/math-attempt\/\d+/);
    await expect(page.getByText('100%')).toBeVisible();
    await expect(page.getByText('3 correct')).toBeVisible();
    await expect(page.getByText('0 incorrect')).toBeVisible();
    for (const q of WORKSHEET_QUESTIONS) {
      await expect(page.getByText(q.questionText).first()).toBeVisible();
    }
  });
});
