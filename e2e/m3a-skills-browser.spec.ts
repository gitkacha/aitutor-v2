import { test, expect, request as pwRequest } from '@playwright/test';

// M3a Task 10: the admin Skills browser — a read-only view over the taxonomy seeded in
// Task 2 (89 skills: 82 math skills across 20 topics + 7 writing skills). Admin-only:
// the sidebar link and the /skills route itself are gated the same way as /superadmin
// (W-15's RequireSuperAdmin pattern) — students never see the link and are bounced to
// the dashboard on direct navigation.

test.describe('M3a Task 10 — Skills browser (admin)', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test('admin sees the Skills page grouped by topic, with a per-skill details toggle', async ({ page, baseURL }) => {
    // Confirm the exact seeded display name/description via the API rather than
    // hardcoding case-sensitively (brief note).
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const skills = await (await admin.get('/api/skills')).json();
    const target = skills.find((s: any) => s.slug === 'faster-long-division');
    expect(target, 'faster-long-division must be seeded').toBeTruthy();
    await admin.dispose();

    await page.goto('/skills');
    await expect(page.getByRole('heading', { name: 'Skills', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Arithmetic', exact: true })).toBeVisible();

    await expect(page.getByText(target.name, { exact: true })).toBeVisible();
    await expect(page.getByText(target.description, { exact: true })).toBeVisible();

    // examLevelNotes is behind the per-skill expand toggle — hidden until clicked.
    await expect(page.getByText(target.examLevelNotes, { exact: true })).not.toBeVisible();
    await page.getByText(target.name, { exact: true }).click();
    await expect(page.getByText(target.examLevelNotes, { exact: true })).toBeVisible();

    // Writing criteria group is present too.
    await expect(page.getByRole('heading', { name: 'Writing criteria', exact: true })).toBeVisible();
  });
});

test.describe('M3a Task 10 — Skills browser is admin-only', () => {
  test('a student has no Skills link and /skills redirects to the dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: 'Skills' })).toHaveCount(0);
    await page.goto('/skills');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
