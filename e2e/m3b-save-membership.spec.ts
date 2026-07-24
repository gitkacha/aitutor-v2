import { test, expect, request as pwRequest } from '@playwright/test';

// M3b Task 2: Enforce that a worksheet question's skill tag actually belongs to that
// question's topic (and is a math skill). A writing skill like 'vocabulary' must not
// be used on a math question.

test('worksheet save: reject mismatched skill-topic pairs', async ({ baseURL }) => {
  const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
  const student = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });
  const studentMe = await (await student.get('/api/auth/me')).json();

  const stamp = Date.now();

  // Negative control: attempt to save an arithmetic question with a writing skill slug.
  // Expect 400 with an error message containing 'does not belong'.
  const badSave = await admin.post('/api/math/worksheets/save', {
    data: {
      title: `M3B-BAD ${stamp}`,
      topicIds: ['arithmetic'],
      studentIds: [studentMe.user.id],
      questions: [
        {
          questionText: `M3B-BAD Q1 ${stamp}: This should fail because vocabulary is a writing skill.`,
          options: ['A', 'B', 'C', 'D'],
          correctIndex: 0,
          explanation: 'Should not be saved.',
          topicSlug: 'arithmetic',
          skillSlug: 'vocabulary', // Writing skill, not math — should be rejected
        },
      ],
    },
  });
  expect(badSave.status()).toBe(400);
  const badResponse = await badSave.json();
  expect(badResponse.error).toContain('does not belong');

  // Positive control: save the same question with a valid arithmetic skill slug.
  // Expect 201.
  const goodSave = await admin.post('/api/math/worksheets/save', {
    data: {
      title: `M3B-GOOD ${stamp}`,
      topicIds: ['arithmetic'],
      studentIds: [studentMe.user.id],
      questions: [
        {
          questionText: `M3B-GOOD Q1 ${stamp}: This should succeed with a valid arithmetic skill.`,
          options: ['A', 'B', 'C', 'D'],
          correctIndex: 0,
          explanation: 'Successfully saved.',
          topicSlug: 'arithmetic',
          skillSlug: 'mental-addition-subtraction', // Valid arithmetic skill
        },
      ],
    },
  });
  expect(goodSave.status()).toBe(201);

  await admin.dispose();
  await student.dispose();
});
