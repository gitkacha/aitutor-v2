import { test, expect } from '@playwright/test';
import http from 'http';

// Phase C / C3 (W-112): the admin Skills page offers "Generate lesson" for Thinking Skills skills
// (was math-only). Clicking it generates a draft (model stubbed) and opens the module editor.
const STUB_PORT = 3106;
const LESSON = `## The idea
Find what is forced.

## Step by step
Check every clue.

## Worked examples
A before B, B before C, so A before C.

## Traps to avoid
Do not accept a merely-possible option.`;

function startStub(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: LESSON } }] }));
    });
  });
  return new Promise((r) => server.listen(STUB_PORT, '127.0.0.1', () => r(server)));
}

test.describe('W-112 — Skills page generates Thinking Skills lessons', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });
  let stub: http.Server;
  test.beforeAll(async () => { stub = await startStub(); });
  test.afterAll(async () => { await new Promise((r) => stub.close(r)); });

  test('a Thinking Skills skill offers Generate lesson and opens the editor', async ({ page }) => {
    await page.goto('/skills');
    const group = page.locator('section', { has: page.getByRole('heading', { name: 'Thinking Skills' }) });
    // Generation is now an A/B choice; "Standard" is approach A (W-118).
    const genBtn = group.getByRole('button', { name: 'Standard' }).first();
    await expect(genBtn).toBeVisible();

    await genBtn.click();
    await expect(page).toHaveURL(/\/admin\/modules\/\d+/, { timeout: 20000 });
    await expect(page.getByText('Find what is forced.').first()).toBeVisible();
  });
});
