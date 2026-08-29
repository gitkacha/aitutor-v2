import { test, expect, request as pwRequest } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import http from 'http';
import path from 'path';

// W-94 (Thinking Skills, Task 6): the coach chat generate_worksheet tool generates a THINKING-SKILLS
// worksheet through the shared engine and saves it UNASSIGNED. Combined stub on :3106 branches on the
// request body: chat loop (has "tools") vs generation vs verifier ("independently solving") vs
// skill-tag ("skill tag").
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
const STUB_PORT = 3106;

// 4-option thinking-skills questions (logical-analysis), correct answer index 0.
const tsQuestions = (n: number) => Array.from({ length: n }, (_, i) => ({
  questionText: `TS logical-analysis question ${i + 1}: which statement must be true given clue ${i + 1}?`,
  options: ['Statement A', 'Statement B', 'Statement C', 'None of the above'],
  correctIndex: 0,
  explanation: 'Only the first statement is forced by the clues. Therefore, the answer is Option A.',
  topicSlug: 'logical-analysis', topicName: 'Logical Analysis', skillSlug: 'logical-analysis',
}));

function startCombinedStub(): Promise<http.Server> {
  let chatCalls = 0;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let reply: unknown;
      if (body.includes('independently solving')) {
        reply = { choices: [{ message: { content: JSON.stringify({ correctIndex: 0 }) } }] }; // verifier passes
      } else if (body.includes('skill tag')) {
        reply = { choices: [{ message: { content: JSON.stringify({ skillSlug: 'logical-analysis' }) } }] };
      } else if (body.includes('"tools"')) {
        // Chat loop: first call proposes the gated generate_worksheet action; later calls narrate.
        reply = chatCalls++ === 0
          ? { choices: [{ message: { content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'generate_worksheet', arguments: JSON.stringify({ subject: 'thinking-skills', skillSlugs: ['logical-analysis'], questionCount: 8 }) } }] } }], usage: {} }
          : { choices: [{ message: { content: 'Saved a Logical Analysis worksheet to your workspace — review and assign it from the Admin page.' } }], usage: {} };
      } else {
        reply = { choices: [{ message: { content: JSON.stringify(tsQuestions(8)) } }] }; // generation
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(reply));
    });
  });
  return new Promise((r) => server.listen(STUB_PORT, '127.0.0.1', () => r(server)));
}

test.describe('W-94 — coach chat generates a thinking-skills worksheet', () => {
  let stub: http.Server;
  test.beforeAll(async () => { stub = await startCombinedStub(); });
  test.afterAll(async () => { await new Promise((r) => stub.close(r)); await prisma.$disconnect(); });

  test('generate_worksheet (subject thinking-skills) saves an unassigned worksheet; questions not in the transcript', async ({ baseURL }) => {
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const before = await prisma.mathWorksheet.count();

    const created = await admin.post('/api/chat/sessions', { data: {} });
    const { id: sessionId } = await created.json();
    const step = await (await admin.post(`/api/chat/sessions/${sessionId}/messages`, {
      data: { content: 'Generate a 8-question Logical Analysis thinking skills worksheet' },
    })).json();

    // The generate action is gated (not executed yet).
    expect(step.pendingAction?.toolName).toBe('generate_worksheet');
    expect(await prisma.mathWorksheet.count(), 'nothing saved before confirm').toBe(before);

    const confirmed = await (await admin.post(`/api/chat/sessions/${sessionId}/confirm`, {
      data: { actionId: step.pendingAction.id, approve: true },
    })).json();

    // A worksheet over thinking-skills topics was saved, UNASSIGNED.
    const ws = await prisma.mathWorksheet.findFirst({ orderBy: { id: 'desc' }, include: { questionRows: { include: { topic: true } }, assignments: true } });
    expect(ws!.assignments.length, 'saved unassigned').toBe(0);
    expect(ws!.questionRows.length).toBeGreaterThanOrEqual(1);
    expect(ws!.questionRows.every((q) => q.topic.subject === 'thinking-skills')).toBe(true);
    expect(JSON.parse(ws!.questionRows[0].options).length, '4-option').toBe(4);

    // The full questions never entered the chat transcript (only a compact tool result).
    const transcript = JSON.stringify(confirmed.messages);
    expect(transcript).not.toContain('which statement must be true given clue');

    await admin.dispose();
  });
});
