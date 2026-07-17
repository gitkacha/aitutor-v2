import { test, expect, APIRequestContext } from '@playwright/test';

// H5 (docs/review2.md §High): MathQuestion.worksheetId was ON DELETE SET NULL, and topic
// practice banks are defined as `worksheetId: null` — so deleting a worksheet *promoted*
// its persisted questions into the banks. Reproduced through the demo cycle: load demo →
// start the demo math worksheet (materialises its question rows) → clear demo. Topic bank
// counts must be identical before and after.

async function topicQuestionCounts(request: APIRequestContext): Promise<Record<string, number>> {
  const topics = await (await request.get('/api/math/topics')).json();
  const counts: Record<string, number> = {};
  for (const t of topics) {
    const full = await (await request.get(`/api/math/topics/${t.slug}`)).json();
    counts[t.slug] = full.questions.length;
  }
  return counts;
}

test.describe('H5 — deleting a math worksheet must not leak questions into topic banks', () => {
  test('demo load → start demo worksheet → clear demo leaves every topic bank unchanged', async ({
    request,
  }) => {
    const before = await topicQuestionCounts(request);

    const load = await request.post('/api/demo/load');
    expect(load.ok()).toBeTruthy();

    // Find the demo math worksheet and materialise its question rows, exactly as starting
    // it from the UI would.
    const worksheets = await (await request.get('/api/math/worksheets')).json();
    const demoWs = worksheets.find((w: { isDemo: boolean }) => w.isDemo);
    expect(demoWs, 'demo math worksheet must exist after demo load').toBeTruthy();

    const qs = await request.get(`/api/math/questions?worksheet=${demoWs.id}`);
    expect(qs.ok()).toBeTruthy();
    expect((await qs.json()).length).toBeGreaterThan(0);

    const clear = await request.post('/api/demo/clear');
    expect(clear.ok(), 'clearing demo data must succeed').toBeTruthy();

    // The demo worksheet is gone…
    const after = await (await request.get('/api/math/worksheets')).json();
    expect(after.find((w: { id: number }) => w.id === demoWs.id)).toBeUndefined();

    // …and no topic bank gained or lost a question.
    const counts = await topicQuestionCounts(request);
    expect(counts, 'topic banks must be unchanged by the demo worksheet lifecycle').toEqual(before);
  });
});
