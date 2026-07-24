import { test, expect, request as pwRequest } from '@playwright/test';

// W-28: the in-test questions payload must not leak answers to students. A student fetching
// /api/math/questions (topic or worksheet mode) gets questions WITHOUT correctIndex/explanation;
// an admin keeps them (for the read-only worksheet-content view). Server-side scoring and the
// post-submission review endpoint are unchanged.

test.describe('W-28 — answers are not leaked in the student in-test payload', () => {
  test('student topic-mode questions omit correctIndex and explanation', async ({ baseURL }) => {
    const student = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });
    const qs = await (await student.get('/api/math/questions?topic=arithmetic')).json();
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) {
      expect(q, 'correctIndex must not be present').not.toHaveProperty('correctIndex');
      expect(q, 'explanation must not be present').not.toHaveProperty('explanation');
      // The fields a student legitimately needs to take the test are still there.
      expect(q).toHaveProperty('id');
      expect(q).toHaveProperty('options');
    }
    await student.dispose();
  });

  test('worksheet mode: stripped for the assigned student, full for the admin', async ({ baseURL }) => {
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const stamp = Date.now();
    const save = await admin.post('/api/math/worksheets/save', {
      data: {
        title: `W28 ${stamp}`, topicIds: ['arithmetic'],
        questions: [
          { questionText: `W28Q1 ${stamp}: 6 × 7?`, options: ['36', '42', '48', '54', '40'], correctIndex: 1, explanation: 'Six sevens are 42.', topicSlug: 'arithmetic', skillSlug: 'mental-multiplication-strategies' },
          { questionText: `W28Q2 ${stamp}: 81 ÷ 9?`, options: ['7', '8', '9', '10', '6'], correctIndex: 2, explanation: 'Nine nines are 81.', topicSlug: 'arithmetic', skillSlug: 'faster-long-division' },
        ],
      },
    });
    expect(save.status()).toBe(201);
    const worksheetId = (await save.json()).id as number;

    // Admin keeps the answer fields (the worksheet-content view relies on them).
    const adminRows = await (await admin.get(`/api/math/questions?worksheet=${worksheetId}`)).json();
    expect(adminRows.length).toBe(2);
    for (const q of adminRows) {
      expect(q).toHaveProperty('correctIndex');
      expect(q).toHaveProperty('explanation');
    }

    // The assigned student gets the same questions with the answers stripped.
    const student = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });
    const studentRows = await (await student.get(`/api/math/questions?worksheet=${worksheetId}`)).json();
    expect(studentRows.length).toBe(2);
    for (const q of studentRows) {
      expect(q).not.toHaveProperty('correctIndex');
      expect(q).not.toHaveProperty('explanation');
    }

    // Regression: scoring is server-side, so the student still scores correctly, and the
    // post-submission review still exposes the correct answers + explanations.
    const byId = new Map(adminRows.map((q: any) => [q.id, q.correctIndex]));
    const ids = studentRows.map((q: any) => q.id);
    const answers = ids.map((id: number) => byId.get(id));
    const now = new Date();
    const submit = await student.post('/api/math/attempts', {
      data: {
        worksheetId,
        questions: JSON.stringify(ids),
        answers: JSON.stringify(answers),
        startedAt: new Date(now.getTime() - 60000).toISOString(),
        finishedAt: now.toISOString(),
        timeTaken: 60,
        source: 'worksheet',
      },
    });
    expect(submit.status()).toBe(201);
    const attempt = await submit.json();
    expect(attempt.score, 'server scores from the DB, not the client payload').toBe(2);

    const review = await (await student.get(`/api/math/attempts/${attempt.id}`)).json();
    for (const q of review.questionDetails) {
      expect(q).toHaveProperty('correctIndex');
      expect((q.explanation || '').length).toBeGreaterThan(0);
    }
    await admin.dispose();
    await student.dispose();
  });
});
