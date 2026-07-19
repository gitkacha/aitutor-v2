import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';

// W-10 / Milestone 2 Phase B1: tenant scoping and authorization. Students see only
// their own rows; admins see their workspace and may target one member with
// ?studentId=; worksheet generation/save and demo data are admin-only; saved
// worksheets are auto-assigned to every student in the workspace (interim default
// until the C1 picker) and student lists show only assigned worksheets.

const ADMIN_STATE = 'e2e/.auth/admin.json';
const S2 = { name: 'W10 Second Student', email: 'w10-student2@test.local', password: 'test1234' };

async function loginContext(baseURL: string, email: string, password: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL });
  const res = await ctx.post('/api/auth/login', { data: { email, password } });
  expect(res.ok(), `login for ${email}`).toBeTruthy();
  return ctx;
}

async function createAttempt(ctx: APIRequestContext): Promise<number> {
  const type = await (await ctx.get('/api/types/persuasive')).json();
  const now = Date.now();
  const res = await ctx.post('/api/attempts', {
    data: {
      typeId: type.id,
      promptId: type.prompts[0].id,
      text: 'W-10 scoping fixture attempt.',
      startedAt: new Date(now - 60_000).toISOString(),
      finishedAt: new Date(now).toISOString(),
      timeTaken: 60,
      source: 'practice',
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).id;
}

test.describe('W-10 — tenant scoping and authorization', () => {
  let admin: APIRequestContext;
  let student2: APIRequestContext;
  let s2Id: number;
  let s2AttemptId: number;

  test.beforeAll(async ({ baseURL }) => {
    admin = await loginContext(baseURL!, 'e2e-admin@test.local', 'test1234');
    // Provision a second student in the same workspace (idempotent across runs).
    const created = await admin.post('/api/workspace/users', {
      data: { ...S2, role: 'student' },
    });
    expect([201, 409]).toContain(created.status());
    student2 = await loginContext(baseURL!, S2.email, S2.password);
    s2Id = (await (await student2.get('/api/auth/me')).json()).user.id;
    s2AttemptId = await createAttempt(student2);
  });

  test.afterAll(async () => {
    await admin?.dispose();
    await student2?.dispose();
  });

  test('a student cannot read another student\'s attempt; an admin in the workspace can', async ({ request }) => {
    // `request` runs as the default e2e student.
    expect((await request.get(`/api/attempts/${s2AttemptId}`)).status()).toBe(404);
    expect((await admin.get(`/api/attempts/${s2AttemptId}`)).status()).toBe(200);
  });

  test('list and aggregate reads are scoped to the session student', async ({ request }) => {
    const me = (await (await request.get('/api/auth/me')).json()).user;
    await createAttempt(request); // self-contained: the default student owns at least one row
    const attempts = await (await request.get('/api/attempts')).json();
    expect(attempts.length).toBeGreaterThan(0);
    for (const a of attempts) expect(a.userId, 'student list leaks another user').toBe(me.id);
    expect(attempts.find((a: any) => a.id === s2AttemptId)).toBeUndefined();

    const mathAttempts = await (await request.get('/api/math/attempts')).json();
    for (const a of mathAttempts) expect(a.userId).toBe(me.id);
  });

  test('students are refused studentId targeting and admin APIs; anonymous reads are 401', async ({ request, baseURL }) => {
    expect((await request.get(`/api/attempts?studentId=${s2Id}`)).status()).toBe(403);
    expect((await request.get(`/api/heatmap?studentId=${s2Id}`)).status()).toBe(403);
    expect((await request.post('/api/worksheets/generate', { data: { typeIds: [1] } })).status()).toBe(403);
    expect((await request.post('/api/worksheets/save', {
      data: { title: 'x', typeIds: [1], prompts: ['x'] },
    })).status()).toBe(403);
    expect((await request.post('/api/math/worksheets/save', {
      data: { title: 'x', topicIds: [], questions: [{ questionText: 'q', options: ['a', 'b'], correctIndex: 0, explanation: 'e', topicSlug: 'fractions' }] },
    })).status()).toBe(403);
    expect((await request.post('/api/demo/load')).status()).toBe(403);

    // Explicit empty storage — the runner's default project storageState (the e2e
    // student) would otherwise leak into a plain newContext.
    const anon = await pwRequest.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    expect((await anon.get('/api/heatmap')).status()).toBe(401);
    expect((await anon.get('/api/attempts')).status()).toBe(401);
    await anon.dispose();
  });

  test('admin ?studentId= targets one workspace member; unknown targets are 403', async () => {
    // The targeted heatmap must match exactly what that student's own session reports —
    // proving the admin view is scoped to s2 and nobody else.
    const adminView = await (await admin.get(`/api/heatmap?studentId=${s2Id}`)).json();
    const s2View = await (await student2.get('/api/heatmap')).json();
    const counts = (h: any[]) => Object.fromEntries(h.map((e) => [e.typeSlug, e.attemptCount]));
    expect(counts(adminView)).toEqual(counts(s2View));
    expect(adminView.find((h: any) => h.typeSlug === 'persuasive').attemptCount).toBeGreaterThanOrEqual(1);

    const adminStats = (await (await admin.get(`/api/stats?studentId=${s2Id}`)).json()).sessionsThisWeek;
    const s2Stats = (await (await student2.get('/api/stats')).json()).sessionsThisWeek;
    expect(adminStats).toBe(s2Stats);

    expect((await admin.get('/api/attempts?studentId=9999999')).status()).toBe(403);
  });

  test('saved worksheets are auto-assigned to every student and visible to them', async ({ request }) => {
    const guide = await (await admin.get('/api/types/guide')).json();
    const save = await admin.post('/api/worksheets/save', {
      data: { title: 'W10 assignment check', typeIds: [guide.id], prompts: ['W10 guide prompt.'] },
    });
    expect(save.status()).toBe(201);
    const [saved] = await save.json();

    // Admin list carries the assignments; both students are covered.
    const adminList = await (await admin.get('/api/worksheets')).json();
    const mine = adminList.find((w: any) => w.id === saved.id);
    expect(mine.assignments, 'admin worksheet list exposes assignments').toBeTruthy();
    const assignedIds = mine.assignments.map((a: any) => a.studentId);
    expect(assignedIds).toContain(s2Id);

    // Both students see it in their scoped lists; their attempt includes are their own.
    for (const ctx of [request, student2]) {
      const list = await (await ctx.get('/api/worksheets')).json();
      expect(list.find((w: any) => w.id === saved.id), 'assigned student sees the worksheet').toBeTruthy();
    }
  });
});
