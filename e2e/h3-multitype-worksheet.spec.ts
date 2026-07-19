import { test, expect } from '@playwright/test';
import http from 'http';

// H3 (docs/review.md §High): selecting several text types for a writing worksheet silently
// kept only the first (`typeId: typeIds[0]`) — the worksheet never surfaced for the other
// types. A writing attempt is always a single text type, so a multi-type selection must
// produce one tailored worksheet per selected type.

const STUB_PORT = 3106;
const TYPE_NAMES = [
  'Advertisement', 'Advice Sheet', 'Diary Entry', 'Discussion', 'Guide', 'Letter',
  'Narrative/Creative', 'News Report', 'Persuasive', 'Review', 'Speech',
];

// Replies to each generation call with a prompt naming the text type it was asked about.
function startWritingStub(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const content: string = JSON.parse(body).messages?.[0]?.content || '';
      const type = TYPE_NAMES.find((n) => content.includes(n)) || 'Unknown';
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify([`E2E prompt about ${type}`]) } }] }));
    });
  });
  return new Promise((resolve) => server.listen(STUB_PORT, '127.0.0.1', () => resolve(server)));
}

// Milestone 2 B1: these flows create worksheets / load demo data — admin-only routes.
test.use({ storageState: 'e2e/.auth/admin.json' });

test.describe('H3 — multi-type writing worksheets keep every selected type', () => {
  let stub: http.Server;
  test.beforeAll(async () => {
    stub = await startWritingStub();
  });
  test.afterAll(async () => {
    await new Promise((r) => stub.close(r));
  });

  test('saving with two typeIds surfaces a worksheet for each type', async ({ request }) => {
    const discussion = await (await request.get('/api/types/discussion')).json();
    const review = await (await request.get('/api/types/review')).json();

    const save = await request.post('/api/worksheets/save', {
      data: {
        title: 'E2E multi-type',
        typeIds: [discussion.id, review.id],
        prompts: ['Write a discussion piece.', 'Write a review.'],
      },
    });
    expect(save.status()).toBe(201);

    for (const type of [discussion, review]) {
      const available = await (await request.get(`/api/worksheets/available/${type.id}`)).json();
      expect(available.length, `type ${type.name} should have a worksheet`).toBeGreaterThanOrEqual(1);
    }
  });

  test('admin generate → review → save produces one tailored worksheet per selected type', async ({ page, request }) => {
    await page.goto('/admin');
    // Scope to the generation card — the heatmap on the same tab also has per-type buttons.
    const genCard = page
      .locator('div.bg-white')
      .filter({ has: page.getByRole('heading', { name: 'Generate Writing Worksheet' }) });
    await genCard.getByRole('button', { name: /^Guide/ }).click();
    await genCard.getByRole('button', { name: /^Letter/ }).click();
    await genCard.getByRole('button', { name: /Generate/ }).click();

    // Review step: one tailored prompt per selected type, each labelled with its type.
    await expect(page.getByText('E2E prompt about Guide')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('E2E prompt about Letter')).toBeVisible();

    await page.getByRole('button', { name: 'Save Worksheet' }).click();

    // Both types now have a pending worksheet.
    const guide = await (await request.get('/api/types/guide')).json();
    const letter = await (await request.get('/api/types/letter')).json();
    for (const type of [guide, letter]) {
      const available = await (await request.get(`/api/worksheets/available/${type.id}`)).json();
      expect(available.length, `type ${type.name} should have a worksheet`).toBeGreaterThanOrEqual(1);
    }
    const pending = page.locator('section', { hasText: 'Pending Worksheets' });
    await expect(pending.getByText('Worksheet: Guide')).toBeVisible();
    await expect(pending.getByText('Worksheet: Letter')).toBeVisible();
  });
});
