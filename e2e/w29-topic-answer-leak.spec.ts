import { test, expect, request as pwRequest } from '@playwright/test';

// W-29: the topic-detail endpoint must not leak answers to students. A student fetching
// /api/math/topics/:slug gets each question in topic.questions WITHOUT correctIndex/explanation;
// an admin keeps them. The question count (the only field the pre-test page needs) is unchanged.

test.describe('W-29 — answers are not leaked via the topic-detail endpoint', () => {
  test('student topic detail omits correctIndex and explanation; admin keeps them', async ({ baseURL }) => {
    const student = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });
    const studentTopic = await (await student.get('/api/math/topics/arithmetic')).json();
    expect(studentTopic.questions.length).toBeGreaterThan(0);
    for (const q of studentTopic.questions) {
      expect(q, 'correctIndex must not be present').not.toHaveProperty('correctIndex');
      expect(q, 'explanation must not be present').not.toHaveProperty('explanation');
      // The pre-test page still gets what it needs to render the bank.
      expect(q).toHaveProperty('id');
      expect(q).toHaveProperty('options');
    }
    await student.dispose();

    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const adminTopic = await (await admin.get('/api/math/topics/arithmetic')).json();
    // Same bank, but the admin keeps the answer fields.
    expect(adminTopic.questions.length).toBe(studentTopic.questions.length);
    for (const q of adminTopic.questions) {
      expect(q).toHaveProperty('correctIndex');
      expect(q).toHaveProperty('explanation');
    }
    await admin.dispose();
  });

  test('the pre-test page still shows the topic question count for a student', async ({ page, request }) => {
    const topic = await (await request.get('/api/math/topics/arithmetic')).json();
    const count = topic.questions.length;
    await page.goto('/math/arithmetic');
    await expect(page.getByText(`${count} multiple-choice questions`)).toBeVisible();
  });
});
