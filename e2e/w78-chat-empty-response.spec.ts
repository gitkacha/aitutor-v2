import { test, expect, request as pwRequest } from '@playwright/test';
import { startChatStub, narration } from './helpers/chat-stub';

// W-78: the coach chat rendered an empty assistant bubble when the model returned empty content
// with no tool calls (reproduced in dev: "generate a lesson on vedic math…" → an assistant message
// of length 0). driveLoop must never persist/return an empty assistant turn — it substitutes a
// helpful fallback so the admin always sees a usable response.
test.describe('W-78 — coach chat never returns an empty assistant turn', () => {
  test('an empty model response becomes a non-empty fallback, not a blank bubble', async ({ baseURL }) => {
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    // The model returns empty content and no tool calls (the exact dev failure).
    const stub = await startChatStub([narration('')]);
    try {
      const created = await admin.post('/api/chat/sessions', { data: {} });
      expect(created.status()).toBe(201);
      const { id: sessionId } = await created.json();

      const step = await admin.post(`/api/chat/sessions/${sessionId}/messages`, {
        data: { content: 'generate a lesson on vedic math multiplication of 2 digit numbers' },
      });
      expect(step.status()).toBe(200);
      const result = await step.json();

      const assistantMsg = result.messages.find(
        (m: any) => m.role === 'assistant' && !m.content.includes('__assistantToolCalls'),
      );
      expect(assistantMsg, 'an assistant turn must be stored').toBeTruthy();
      // The bug: this was length 0. The fix: a non-empty, helpful fallback.
      expect(assistantMsg.content.trim().length).toBeGreaterThan(0);
    } finally {
      await new Promise((r) => stub.close(r));
      await admin.dispose();
    }
  });
});
