import { test, expect, request as pwRequest } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// W-97 (Thinking Skills, Task 9): a student taking a Thinking Skills worksheet must NOT see the
// correct answer or explanation until they submit; admins always see them. This is Math's §0.6
// behaviour, inherited via the reused tables/routes — explicitly re-proven for thinking-skills.
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

test.describe('W-97 — Thinking Skills answer-key hygiene', () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('student never sees correctIndex/explanation pre-submit; admin always; review shows post-submit', async ({ baseURL }) => {
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const studentCtx = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });
    const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-admin@test.local' } });
    const student = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-student@test.local' } });
    const topic = await prisma.mathTopic.findFirstOrThrow({ where: { slug: 'logical-analysis' } });

    // A thinking-skills worksheet with persisted question rows carrying the answer key.
    const ws = await prisma.mathWorksheet.create({
      data: {
        workspaceId: adminUser.workspaceId, createdById: adminUser.id,
        title: 'TS Hygiene WS', topicIds: JSON.stringify(['logical-analysis']),
        questions: JSON.stringify([{ questionText: 'Which is forced?', options: ['A', 'B', 'C', 'D'], correctIndex: 0, explanation: 'Because A. Therefore, the answer is Option A.', topicSlug: 'logical-analysis', skillSlug: 'logical-analysis' }]),
      },
    });
    const q = await prisma.mathQuestion.create({
      data: { topicId: topic.id, worksheetId: ws.id, questionText: 'Which is forced?', options: JSON.stringify(['A', 'B', 'C', 'D']), correctIndex: 0, explanation: 'Because A. Therefore, the answer is Option A.' },
    });
    await prisma.mathWorksheetAssignment.create({ data: { worksheetId: ws.id, studentId: student.id } });

    // Student: the worksheet's questions blob is stripped of the answer key.
    const studentList = await (await studentCtx.get('/api/math/worksheets')).json();
    const studentWs = studentList.find((w: any) => w.id === ws.id);
    expect(studentWs, 'student sees the assigned worksheet').toBeTruthy();
    const studentQs = JSON.parse(studentWs.questions);
    expect(studentQs[0]).not.toHaveProperty('correctIndex');
    expect(studentQs[0]).not.toHaveProperty('explanation');
    expect(studentQs[0].options.length).toBe(4);

    // Admin: the same worksheet carries the full answer key.
    const adminList = await (await admin.get('/api/math/worksheets')).json();
    const adminWs = adminList.find((w: any) => w.id === ws.id);
    const adminQs = JSON.parse(adminWs.questions);
    expect(adminQs[0].correctIndex).toBe(0);
    expect(adminQs[0].explanation).toContain('Option A');

    // Post-submit: the attempt review shows the correct answer + explanation.
    const created = await studentCtx.post('/api/math/attempts', {
      data: {
        topicId: topic.id, source: 'worksheet', worksheetId: ws.id,
        questions: JSON.stringify([q.id]), answers: JSON.stringify([1]),
        startedAt: new Date(Date.now() - 30_000).toISOString(), finishedAt: new Date().toISOString(), timeTaken: 30,
      },
    });
    expect(created.status()).toBe(201);
    const attempt = await (await studentCtx.get(`/api/math/attempts/${(await created.json()).id}`)).json();
    const reviewed = attempt.questionDetails.find((d: any) => d.id === q.id);
    expect(reviewed.correctIndex).toBe(0);
    expect(reviewed.explanation).toContain('Option A');

    await admin.dispose();
    await studentCtx.dispose();
  });
});
