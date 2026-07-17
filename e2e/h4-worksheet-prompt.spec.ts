import { test, expect } from '@playwright/test';
import http from 'http';

// H4 (docs/review2.md §High): a worksheet writing attempt stored the type's first bank
// prompt as its promptId while the student answered the worksheet's generated prompt, so
// the AI analysis graded the wrong task. The attempt must reference the worksheet's real
// prompt, and the analysis request must carry that prompt's text.

const STUB_PORT = 3106;

const WORKSHEET_PROMPT =
  'E2E-H4 worksheet prompt: write a diary entry about the day the school library became a spaceship.';
const ESSAY_TEXT =
  'Dear Diary, today the library shelves hummed and lifted us into orbit. E2E-H4 essay body.';

const STUB_ANALYSIS = {
  vocabScore: 70,
  vocabComments: 'Good imagery around the library spaceship.',
  structureScore: 68,
  structureComments: 'Clear diary structure with a date and closing thought.',
  contentScore: 72,
  contentComments: 'Responds to the worksheet prompt directly.',
  overallScore: 70,
  summary: 'A solid diary entry for the worksheet task.',
};

// Serves analysis responses and captures every request body for inspection.
function startAnalysisStub(captured: string[]): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      captured.push(body);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(STUB_ANALYSIS) } }] }));
    });
  });
  return new Promise((resolve) => server.listen(STUB_PORT, '127.0.0.1', () => resolve(server)));
}

test.describe('H4 — worksheet attempts reference the worksheet prompt, not a bank prompt', () => {
  let stub: http.Server;
  const captured: string[] = [];

  test.beforeAll(async () => {
    stub = await startAnalysisStub(captured);
  });
  test.afterAll(async () => {
    await new Promise((r) => stub.close(r));
  });

  test('student worksheet attempt saves the worksheet prompt and the analysis grades against it', async ({
    page,
    request,
  }) => {
    const type = await (await request.get('/api/types/diary-entry')).json();
    const bankPrompt: string = type.prompts[0].text;

    const save = await request.post('/api/worksheets/save', {
      data: { title: 'E2E H4 worksheet', typeIds: [type.id], prompts: [WORKSHEET_PROMPT] },
    });
    expect(save.status()).toBe(201);

    // Student starts the worksheet from the type page.
    await page.goto('/practice/diary-entry');
    await expect(page.getByRole('main').getByText('E2E H4 worksheet')).toBeVisible();
    // Scope to main — the sidebar's "Up next" card has its own Start button.
    await page.getByRole('main').getByRole('button', { name: 'Start', exact: true }).click();

    // The timed screen shows the worksheet's prompt.
    await expect(page.getByText(WORKSHEET_PROMPT)).toBeVisible();
    await page.locator('textarea').fill(ESSAY_TEXT);
    await page.getByRole('button', { name: 'Submit Early' }).click();
    await page.getByRole('button', { name: 'Submit Now' }).click();

    // Attempt detail triggers the (stubbed) analysis.
    await page.waitForURL(/\/attempt\/\d+/);
    await expect(page.getByText(STUB_ANALYSIS.summary)).toBeVisible({ timeout: 15_000 });

    // The stored attempt references the worksheet's prompt, not the type's bank prompt.
    const attemptId = Number(page.url().match(/\/attempt\/(\d+)/)![1]);
    const attempt = await (await request.get(`/api/attempts/${attemptId}`)).json();
    expect(attempt.worksheetId).not.toBeNull();
    expect(attempt.prompt.text, 'attempt must reference the worksheet prompt').toBe(WORKSHEET_PROMPT);

    // The analysis request for this essay carried the worksheet prompt, not the bank prompt.
    const analysisBody = captured.find((b) => b.includes('E2E-H4 essay body'));
    expect(analysisBody, 'analysis request for the worksheet attempt must exist').toBeTruthy();
    expect(analysisBody!, 'analysis must grade against the worksheet prompt').toContain(WORKSHEET_PROMPT);
    expect(analysisBody!, 'analysis must not grade against the bank prompt').not.toContain(bankPrompt);
  });
});
