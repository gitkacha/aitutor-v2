import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';

// W-15 (docs/superpowers/plans/Milestone2-plan.md addendum): super-admin role + workspace
// provisioning. A super-admin creates workspaces and their first admin, and gets read-only
// oversight of any workspace; normal admins are denied the /api/superadmin/* surface, so
// per-workspace isolation (W-10) is untouched.

async function loginCtx(baseURL: string | undefined, email: string, password = 'test1234'): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL });
  const res = await ctx.post('/api/auth/login', { data: { email, password } });
  expect(res.ok(), `login ${email}`).toBeTruthy();
  return ctx;
}

test.describe('W-15 — super-admin API', () => {
  test('super-admin provisions a workspace + first admin; the new admin runs it but is not super', async ({ baseURL }) => {
    const sup = await loginCtx(baseURL, 'e2e-super@test.local');

    // me reflects the super-admin flag.
    const me = await (await sup.get('/api/auth/me')).json();
    expect(me.user.isSuperAdmin).toBe(true);

    const stamp = Date.now();
    const adminEmail = `w15-admin-${stamp}@test.local`;
    const create = await sup.post('/api/superadmin/workspaces', {
      data: {
        workspaceName: `W15 Workspace ${stamp}`,
        adminName: 'W15 First Admin',
        adminEmail,
        adminPassword: 'test1234',
      },
    });
    expect(create.status()).toBe(201);
    const created = await create.json();
    const newWorkspaceId: number = created.workspace.id;

    // The new first admin can log in, is a normal admin of the new workspace, and can add a
    // student there (delegation) — but cannot reach the super-admin surface.
    const newAdmin = await loginCtx(baseURL, adminEmail);
    const newAdminMe = await (await newAdmin.get('/api/auth/me')).json();
    expect(newAdminMe.user.role).toBe('admin');
    expect(newAdminMe.user.workspaceId).toBe(newWorkspaceId);
    expect(newAdminMe.user.isSuperAdmin).toBe(false);

    const addStudent = await newAdmin.post('/api/workspace/users', {
      data: { name: 'W15 Student', email: `w15-student-${stamp}@test.local`, password: 'test1234', role: 'student' },
    });
    expect(addStudent.status(), 'delegated admin can add a student').toBe(201);

    expect((await newAdmin.post('/api/superadmin/workspaces', { data: {} })).status(),
      'new admin is not a super-admin').toBe(403);

    // Oversight: super-admin lists workspaces (incl. the new one) and reads its members.
    const list = await (await sup.get('/api/superadmin/workspaces')).json();
    expect(list.workspaces.some((w: any) => w.id === newWorkspaceId)).toBe(true);
    const detail = await (await sup.get(`/api/superadmin/workspaces/${newWorkspaceId}`)).json();
    expect(detail.members.some((u: any) => u.email === adminEmail)).toBe(true);
    expect(detail.writingHeatmap).toBeTruthy();
    expect(detail.mathHeatmap).toBeTruthy();

    await sup.dispose();
    await newAdmin.dispose();
  });

  test('a normal admin is denied every super-admin route (isolation intact)', async ({ baseURL }) => {
    const admin = await loginCtx(baseURL, 'e2e-admin@test.local');
    expect((await admin.get('/api/superadmin/workspaces')).status()).toBe(403);
    expect((await admin.post('/api/superadmin/workspaces', { data: {} })).status()).toBe(403);
    expect((await admin.get('/api/superadmin/workspaces/1')).status()).toBe(403);
    await admin.dispose();
  });
});

test.describe('W-15 — super-admin console UI', () => {
  test('super-admin sees the Platform console and creates a workspace through it', async ({ page }) => {
    // Log in as the super-admin in the browser.
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Email').fill('e2e-super@test.local');
    await page.getByLabel('Password').fill('test1234');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole('link', { name: 'Platform' }).click();
    await expect(page).toHaveURL(/\/superadmin/);
    await expect(page.getByRole('heading', { name: 'Platform', exact: true })).toBeVisible();

    const stamp = Date.now();
    await page.getByRole('button', { name: /Create workspace/i }).first().click();
    await page.getByLabel('Workspace name').fill(`UI WS ${stamp}`);
    await page.getByLabel('Admin name').fill('UI Admin');
    await page.getByLabel('Admin email').fill(`w15-ui-${stamp}@test.local`);
    await page.getByLabel('Admin password').fill('test1234');
    await page.getByRole('button', { name: /^Create/ }).click();

    // The new workspace appears in the list (scoped past the success toast).
    await expect(page.getByRole('button', { name: new RegExp(`UI WS ${stamp}`) })).toBeVisible();
  });

  test('a plain admin has no Platform link and /superadmin redirects away', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Email').fill('e2e-admin@test.local');
    await page.getByLabel('Password').fill('test1234');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await expect(page.getByRole('link', { name: 'Platform' })).toHaveCount(0);
    await page.goto('/superadmin');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
