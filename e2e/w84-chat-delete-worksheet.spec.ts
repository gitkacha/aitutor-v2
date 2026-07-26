import { test, expect, request as pwRequest } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { startChatStub, toolCall, narration } from './helpers/chat-stub';

// W-84: an admin can delete an unattempted worksheet from coach chat. The model finds it via the
// list_worksheets read tool, then proposes the confirmation-gated delete_worksheet action; on
// confirm it's deleted.
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

test.describe('W-84 — delete a worksheet via coach chat', () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('list_worksheets → gated delete_worksheet → confirm deletes it', async ({ baseURL }) => {
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-admin@test.local' } });
    const ws = await prisma.mathWorksheet.create({
      data: { workspaceId: adminUser.workspaceId, createdById: adminUser.id, title: 'Chat Delete WS', topicIds: JSON.stringify(['patterns']), questions: JSON.stringify([]) },
    });

    const stub = await startChatStub([
      toolCall('list_worksheets', {}),
      toolCall('delete_worksheet', { subject: 'math', worksheetId: ws.id }),
      narration('Done — that worksheet is deleted.'),
    ]);
    try {
      const created = await admin.post('/api/chat/sessions', { data: {} });
      const { id: sessionId } = await created.json();

      const step = await admin.post(`/api/chat/sessions/${sessionId}/messages`, {
        data: { content: 'delete the unattempted Chat Delete WS worksheet' },
      });
      expect(step.status()).toBe(200);
      const result = await step.json();
      // The delete is gated, not executed yet.
      expect(result.pendingAction?.toolName).toBe('delete_worksheet');
      expect(await prisma.mathWorksheet.findUnique({ where: { id: ws.id } }), 'not deleted before confirm').not.toBeNull();

      const confirm = await admin.post(`/api/chat/sessions/${sessionId}/confirm`, {
        data: { actionId: result.pendingAction.id, approve: true },
      });
      expect(confirm.status()).toBe(200);
      expect(await prisma.mathWorksheet.findUnique({ where: { id: ws.id } }), 'deleted after confirm').toBeNull();
    } finally {
      await new Promise((r) => stub.close(r));
      await admin.dispose();
    }
  });
});
