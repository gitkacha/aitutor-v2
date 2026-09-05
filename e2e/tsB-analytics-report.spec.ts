import { test, expect, request as pwRequest } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import http from 'http';
import path from 'path';

// Phase B / B2 (W-106): the analytics report/opportunity endpoints accept subject=thinking-skills,
// returning TS skill signals — and the math report for the same student excludes them (no leak).
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
const STUB_PORT = 3106;

const tsQuestions = (n: number) => Array.from({ length: n }, (_, i) => ({
  questionText: `TS report question ${i + 1}: which follows from the premises?`,
  options: ['The first', 'The second', 'The third', 'The fourth'],
  correctIndex: 0,
  explanation: 'It follows directly. Therefore, the answer is Option A.',
  topicSlug: 'visual-reasoning', topicName: 'Visual Reasoning', skillSlug: 'visual-reasoning',
}));

function startGenStub(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let reply: unknown;
      if (body.includes('independently solving')) reply = { correctIndex: 0 };
      else if (body.includes('skill tag')) reply = { skillSlug: 'visual-reasoning' };
      else reply = tsQuestions(8);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }));
    });
  });
  return new Promise((r) => server.listen(STUB_PORT, '127.0.0.1', () => r(server)));
}

test.describe('W-106 — analytics exposes thinking-skills', () => {
  test.use({ storageState: 'e2e/.auth/student.json' });
  let stub: http.Server;
  test.beforeAll(async () => { stub = await startGenStub(); });
  test.afterAll(async () => { await new Promise((r) => stub.close(r)); await prisma.$disconnect(); });

  test('report?subject=thinking-skills returns TS skills; math report excludes them', async ({ page, baseURL }) => {
    // Generate a skill-tagged TS practice set and record an attempt on it.
    const start = await page.request.post('/api/math/practice/generate', { data: { topicSlug: 'visual-reasoning' } });
    expect(start.status()).toBe(202);
    const { jobId } = await start.json();
    let worksheetId = 0;
    for (let i = 0; i < 100; i++) {
      const job = await (await page.request.get(`/api/math/practice/jobs/${jobId}`)).json();
      if (job.status === 'done') { worksheetId = job.result.worksheetId; break; }
      if (job.status === 'error') throw new Error(job.error);
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(worksheetId).toBeGreaterThan(0);

    const questions = await (await page.request.get(`/api/math/questions?worksheet=${worksheetId}`)).json();
    const ids = questions.map((q: any) => q.id);
    const now = Date.now();
    const attempt = await page.request.post('/api/math/attempts', {
      data: {
        topicId: questions[0].topicId,
        questions: JSON.stringify(ids),
        answers: JSON.stringify(ids.map(() => 0)),
        startedAt: new Date(now - 120000).toISOString(),
        finishedAt: new Date(now).toISOString(),
        timeTaken: 120,
        source: 'practice',
        questionTimings: JSON.stringify(Object.fromEntries(ids.map((id: number) => [id, 5000]))),
      },
    });
    expect(attempt.status()).toBe(201);

    const student = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-student@test.local' } });
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });

    // TS report contains the visual-reasoning skill…
    const tsReport = await (await admin.get(`/api/analytics/students/${student.id}/report?subject=thinking-skills`)).json();
    expect(tsReport.skills.map((s: any) => s.slug)).toContain('visual-reasoning');

    // …and the math report for the same student does not.
    const mathReport = await (await admin.get(`/api/analytics/students/${student.id}/report?subject=math`)).json();
    expect(mathReport.skills.map((s: any) => s.slug)).not.toContain('visual-reasoning');

    // Opportunity areas accept the subject too; a bogus subject is rejected.
    const opp = await admin.get(`/api/analytics/opportunity-areas?subject=thinking-skills&studentId=${student.id}`);
    expect(opp.status()).toBe(200);
    const bogus = await admin.get(`/api/analytics/students/${student.id}/report?subject=nope`);
    expect(bogus.status()).toBe(400);
    await admin.dispose();
  });
});
