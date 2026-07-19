import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';

// W-12 / Milestone 2 Phase C1 (docs/superpowers/plans/Milestone2-plan.md): the admin
// experience — assignment picker at worksheet save, per-student performance views, and
// workspace member management. Runs as the seeded e2e admin.

test.use({ storageState: 'e2e/.auth/admin.json' });

// Creates a fresh student in the admin's workspace. Unique email per run keeps the shared
// e2e db collision-free; returns { id, email }.
async function makeStudent(request: APIRequestContext, tag: string) {
  const email = `w12-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@test.local`;
  const res = await request.post('/api/workspace/users', {
    data: { name: `W12 ${tag}`, email, password: 'test1234', role: 'student' },
  });
  expect(res.status(), `creating student ${tag}`).toBe(201);
  return { id: (await res.json()).user.id as number, email };
}

// A request context authenticated as the given student.
async function loginAs(baseURL: string | undefined, email: string): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL });
  const res = await ctx.post('/api/auth/login', { data: { email, password: 'test1234' } });
  expect(res.ok(), `login ${email}`).toBeTruthy();
  return ctx;
}

test.describe('W-12 — admin experience', () => {
  test('worksheet save assigns only the selected students, not the whole workspace', async ({ request, baseURL }) => {
    const a = await makeStudent(request, 'assign-a');
    const b = await makeStudent(request, 'assign-b');

    const type = await (await request.get('/api/types/letter')).json();
    const save = await request.post('/api/worksheets/save', {
      data: {
        title: 'W12 targeted worksheet',
        typeIds: [type.id],
        prompts: ['Write a letter about a targeted assignment.'],
        studentIds: [a.id], // only student A
      },
    });
    expect(save.status()).toBe(201);
    const worksheetId = (await save.json())[0].id;

    const aCtx = await loginAs(baseURL, a.email);
    const bCtx = await loginAs(baseURL, b.email);
    const aList = await (await aCtx.get('/api/worksheets')).json();
    const bList = await (await bCtx.get('/api/worksheets')).json();
    expect(aList.some((w: any) => w.id === worksheetId), 'student A was assigned').toBe(true);
    expect(bList.some((w: any) => w.id === worksheetId), 'student B was NOT assigned').toBe(false);
    await aCtx.dispose();
    await bCtx.dispose();
  });

  test('admin can add a workspace member through the Admin UI', async ({ page }) => {
    const email = `w12-ui-${Date.now()}@test.local`;
    await page.goto('/admin');

    await expect(page.getByRole('heading', { name: 'Workspace Members' })).toBeVisible();
    await page.getByRole('button', { name: 'Add member' }).click();
    await page.getByLabel('Name').fill('UI Added Student');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('test1234');
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    // The new member appears in the members list (scoped past the toast + selector option).
    await expect(page.getByText(`· ${email}`)).toBeVisible();
  });

  test('admin performance view has a student selector listing workspace students', async ({ page, request }) => {
    const s = await makeStudent(request, 'perf');
    await page.goto('/admin');
    const selector = page.getByLabel(/View performance for/i);
    await expect(selector, 'admin performance student selector must exist').toBeVisible();
    // The just-created student is selectable (proves the selector lists workspace students).
    await expect(selector.locator(`option:has-text("${s.email}")`)).toHaveCount(1);
  });
});
