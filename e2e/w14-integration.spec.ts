import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';

// W-14 / Milestone 2 Phase D: the cross-role capstone. An admin assigns a worksheet to one
// student; that student sees it, completes it; the admin then reviews exactly that student's
// performance — end to end across the auth, assignment, scoping and heatmap layers.
// (Regression coverage over already-signed-off behaviour; no new production code in Phase D.)

async function adminCtx(baseURL: string | undefined): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL });
  const res = await ctx.post('/api/auth/login', { data: { email: 'e2e-admin@test.local', password: 'test1234' } });
  expect(res.ok()).toBeTruthy();
  return ctx;
}

test.describe('W-14 — multi-user assign → complete → review loop', () => {
  test('admin assigns to one student; the student completes it; the admin reviews that student', async ({ request, baseURL }) => {
    // The e2e student (default storageState) is the recipient.
    const me = await (await request.get('/api/auth/me')).json();
    const studentId: number = me.user.id;

    // Admin saves a math worksheet targeted at just this student.
    const admin = await adminCtx(baseURL);
    const questions = [
      { questionText: 'W14 Q1: 1/2 + 1/4 = ?', options: ['1/4', '3/4', '2/6', '1'], correctIndex: 1, explanation: 'Common denominator 4: 2/4 + 1/4 = 3/4.', topicSlug: 'fractions', skillSlug: 'fraction-arithmetic' },
      { questionText: 'W14 Q2: 3/5 of 20 = ?', options: ['9', '12', '15', '4'], correctIndex: 1, explanation: '20 ÷ 5 × 3 = 12.', topicSlug: 'fractions', skillSlug: 'fractions-of-quantities' },
    ];
    const save = await admin.post('/api/math/worksheets/save', {
      data: { title: `W14 assigned ${Date.now()}`, topicIds: ['fractions'], questions, studentIds: [studentId] },
    });
    expect(save.status()).toBe(201);
    const worksheetId = (await save.json()).id;

    // The student sees it assigned…
    const wsList = await (await request.get('/api/math/worksheets')).json();
    expect(wsList.some((w: any) => w.id === worksheetId), 'student sees the assigned worksheet').toBe(true);

    // …fetches its questions and completes it (all correct). The student's payload omits the
    // answer key (W-28), so the correct answers come from the admin's view, mapped by id.
    const rows = await (await request.get(`/api/math/questions?worksheet=${worksheetId}`)).json();
    expect(rows.length).toBe(2);
    const keyById = new Map(
      (await (await admin.get(`/api/math/questions?worksheet=${worksheetId}`)).json())
        .map((r: any) => [r.id, r.correctIndex]),
    );
    const now = Date.now();
    const attempt = await request.post('/api/math/attempts', {
      data: {
        questions: JSON.stringify(rows.map((r: any) => r.id)),
        answers: JSON.stringify(rows.map((r: any) => keyById.get(r.id))),
        startedAt: new Date(now - 120_000).toISOString(),
        finishedAt: new Date(now).toISOString(),
        timeTaken: 120,
        source: 'worksheet',
        worksheetId,
      },
    });
    expect(attempt.status()).toBe(201);
    expect((await attempt.json()).score).toBe(2);

    // The admin reviews exactly this student's performance (?studentId=) and sees it.
    const attempts = await (await admin.get(`/api/math/attempts?studentId=${studentId}`)).json();
    expect(attempts.some((a: any) => a.worksheetId === worksheetId), 'admin sees the student attempt').toBe(true);
    const heatmap = await (await admin.get(`/api/math/heatmap?studentId=${studentId}`)).json();
    const fractions = heatmap.find((h: any) => h.topicSlug === 'fractions');
    expect(fractions.attemptCount, 'the student\'s fractions attempts are visible to the admin').toBeGreaterThan(0);

    await admin.dispose();
  });
});
