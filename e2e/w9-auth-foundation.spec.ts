import { test, expect } from '@playwright/test';

// W-9 / Milestone 2 Phase A (docs/superpowers/plans/Milestone2-plan.md): the auth
// foundation. Password login against seeded e2e users, session cookie round-trip,
// attempt attribution to the session user, first-run setup guard, and proof that a
// fresh database gets NO demo workspace (the migration backfill is conditional on
// pre-existing data).

// This spec exercises the unauthenticated → authenticated transition itself, so it
// opts out of the suite-wide storageState fixture.
test.use({ storageState: { cookies: [], origins: [] } });

const STUDENT = { email: 'e2e-student@test.local', password: 'test1234' };
const ADMIN = { email: 'e2e-admin@test.local', password: 'test1234' };

test.describe('W-9 — auth foundation', () => {
  test('login issues a session; me reflects it; logout clears it', async ({ request }) => {
    const anon = await request.get('/api/auth/me');
    expect(anon.status(), 'me without a session is 401').toBe(401);

    const bad = await request.post('/api/auth/login', {
      data: { email: STUDENT.email, password: 'wrong-password' },
    });
    expect(bad.status(), 'wrong password is 401').toBe(401);

    const login = await request.post('/api/auth/login', { data: STUDENT });
    expect(login.status()).toBe(200);
    const { user } = await login.json();
    expect(user.email).toBe(STUDENT.email);
    expect(user.role).toBe('student');
    expect(user.passwordHash, 'password hash must never leave the API').toBeUndefined();

    const me = await request.get('/api/auth/me');
    expect(me.status()).toBe(200);
    expect((await me.json()).user.email).toBe(STUDENT.email);

    const logout = await request.post('/api/auth/logout');
    expect(logout.ok()).toBeTruthy();
    expect((await request.get('/api/auth/me')).status()).toBe(401);
  });

  test('attempt writes require a session and are attributed to it', async ({ request }) => {
    const now = Date.now();
    const basePayload = {
      text: 'W-9 attribution check.',
      startedAt: new Date(now - 60_000).toISOString(),
      finishedAt: new Date(now).toISOString(),
      timeTaken: 60,
      source: 'practice',
    };

    // Curriculum reads require auth too (B1), so an anonymous write can't even resolve
    // a prompt — post with placeholder ids; the 401 fires before any lookup.
    const anon = await request.post('/api/attempts', {
      data: { ...basePayload, typeId: 1, promptId: 1 },
    });
    expect(anon.status(), 'unauthenticated attempt writes are rejected').toBe(401);

    await request.post('/api/auth/login', { data: STUDENT });
    const me = await (await request.get('/api/auth/me')).json();
    const type = await (await request.get('/api/types/persuasive')).json();
    const created = await request.post('/api/attempts', {
      data: { ...basePayload, typeId: type.id, promptId: type.prompts[0].id },
    });
    expect(created.status()).toBe(201);
    expect((await created.json()).userId, 'attempt belongs to the session user').toBe(me.user.id);
  });

  test('admin role round-trips; setup is closed once users exist', async ({ request }) => {
    const login = await request.post('/api/auth/login', { data: ADMIN });
    expect(login.status()).toBe(200);
    expect((await login.json()).user.role).toBe('admin');

    const status = await (await request.get('/api/setup/status')).json();
    expect(status.needsSetup, 'seeded e2e db does not need first-run setup').toBe(false);

    const setup = await request.post('/api/setup', {
      data: { workspaceName: 'Nope', name: 'X', email: 'x@x.local', password: 'xxxxxxxx' },
    });
    expect(setup.status(), 'setup is refused once any user exists').toBe(409);
  });

  test('a fresh database gets no demo workspace (backfill is conditional)', async ({ request }) => {
    // The e2e db is created empty by this suite's stack, so the migration must NOT
    // have planted the demo workspace users.
    const demoLogin = await request.post('/api/auth/login', {
      data: { email: 'demo-admin@demo.local', password: 'demo1234' },
    });
    expect(demoLogin.status(), 'demo users exist only where pre-migration data existed').toBe(401);
  });
});
