import { test, expect } from '@playwright/test';

// H2 (docs/review.md §High): Express 4 does not catch rejected promises from async route
// handlers, so a throw inside one (malformed client JSON, a Prisma error) never reaches
// middleware/error.ts — the request hangs or the process dies on the unhandled rejection.
// These tests prove every failure path answers promptly with a JSON error and that the
// backend survives it.

test.describe('H2 — async route errors reach the error middleware', () => {
  test('malformed questions JSON on POST /api/math/attempts returns 400, not a hang', async ({ request }) => {
    const res = await request.post('/api/math/attempts', {
      data: {
        questions: 'not-json',
        answers: '[]',
        startedAt: new Date(Date.now() - 60_000).toISOString(),
        finishedAt: new Date().toISOString(),
        timeTaken: 60,
      },
      timeout: 15_000,
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('a Prisma rejection on POST /api/attempts returns 500 via the error middleware and the server survives', async ({ request }) => {
    const res = await request.post('/api/attempts', {
      data: {
        typeId: 'not-a-number', // truthy, passes field validation, rejects inside Prisma
        promptId: 1,
        text: 'hello',
        startedAt: new Date(Date.now() - 60_000).toISOString(),
        finishedAt: new Date().toISOString(),
        timeTaken: 60,
      },
      timeout: 15_000,
    });
    expect(res.status()).toBe(500);
    const body = await res.json();
    expect(body.error).toBeTruthy();

    // The unhandled rejection must not have killed the backend.
    const health = await request.get('/api/health', { timeout: 5_000 });
    expect(health.ok()).toBeTruthy();
  });
});
