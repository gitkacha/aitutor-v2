import { test, expect, request as pwRequest } from '@playwright/test';

// W-30: the worksheet-list endpoint must not leak answers to students. Each math worksheet
// stores its questions as a JSON blob carrying correctIndex/explanation; GET /api/math/worksheets
// returns that whole row. A student (assigned the worksheet) must get the blob with the answer
// fields stripped from every question — the count is preserved — while an admin keeps them.

function parse(ws: any): any[] {
  return JSON.parse(ws.questions || '[]');
}

test('worksheet list: stripped for the assigned student, full for the admin', async ({ baseURL }) => {
  const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
  const student = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });
  const me = await (await student.get('/api/auth/me')).json();

  const stamp = Date.now();
  const save = await admin.post('/api/math/worksheets/save', {
    data: {
      title: `W30 ${stamp}`, topicIds: ['arithmetic'], studentIds: [me.user.id],
      questions: [
        { questionText: `W30Q1 ${stamp}: 6 × 7?`, options: ['36', '42', '48', '54', '40'], correctIndex: 1, explanation: 'Six sevens are 42.', topicSlug: 'arithmetic' },
        { questionText: `W30Q2 ${stamp}: 81 ÷ 9?`, options: ['7', '8', '9', '10', '6'], correctIndex: 2, explanation: 'Nine nines are 81.', topicSlug: 'arithmetic' },
      ],
    },
  });
  expect(save.status()).toBe(201);
  const worksheetId = (await save.json()).id as number;

  // Admin keeps the answer fields in the stored blob.
  const adminList = await (await admin.get('/api/math/worksheets')).json();
  const adminWs = adminList.find((w: any) => w.id === worksheetId);
  const adminQs = parse(adminWs);
  expect(adminQs.length).toBe(2);
  for (const q of adminQs) {
    expect(q).toHaveProperty('correctIndex');
    expect(q).toHaveProperty('explanation');
  }

  // The assigned student gets the same worksheet with the answers stripped, count preserved.
  const studentList = await (await student.get('/api/math/worksheets')).json();
  const studentWs = studentList.find((w: any) => w.id === worksheetId);
  expect(studentWs, 'student sees the assigned worksheet').toBeTruthy();
  const studentQs = parse(studentWs);
  expect(studentQs.length, 'count is preserved for the UI').toBe(2);
  for (const q of studentQs) {
    expect(q, 'correctIndex must not be present').not.toHaveProperty('correctIndex');
    expect(q, 'explanation must not be present').not.toHaveProperty('explanation');
  }

  await admin.dispose();
  await student.dispose();
});
