import { test, expect } from '@playwright/test';

// W-11 / Milestone 2 Phase B2 (docs/superpowers/plans/Milestone2-plan.md): the frontend
// auth shell — route guard, login screen, sidebar identity, sign out.
//
// The Setup screen's happy path cannot run against the seeded e2e database (users
// already exist, so /api/setup is closed); only its guard is covered here. The live
// first-run walkthrough happens in Phase D against a fresh database.

// These tests drive the unauthenticated → authenticated UI transition, so they opt out
// of the suite-wide student storageState.
test.use({ storageState: { cookies: [], origins: [] } });

const STUDENT = { email: 'e2e-student@test.local', password: 'test1234' };

test.describe('W-11 — frontend auth shell', () => {
  test('anonymous visits are redirected to the login screen', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByText('Progress Dashboard')).not.toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/w11-login.png' });
  });

  test('wrong password shows a clear error and stays on the login screen', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(STUDENT.email);
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Invalid email or password')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    await page.screenshot({ path: 'docs/screenshots/w11-login-error.png' });
  });

  test('login lands on the dashboard with the signed-in identity in the sidebar', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(STUDENT.email);
    await page.getByLabel('Password').fill(STUDENT.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    const rail = page.locator('aside');
    await expect(rail.getByText('E2E Student')).toBeVisible();
    await expect(rail.getByText('Student', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/w11-signed-in-sidebar.png' });
  });

  test('the original destination is restored after login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel('Email').fill(STUDENT.email);
    await page.getByLabel('Password').fill(STUDENT.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/admin/);
  });

  test('sign out returns to login and the guard re-engages', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(STUDENT.email);
    await page.getByLabel('Password').fill(STUDENT.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('an authenticated user visiting /login bounces to the dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(STUDENT.email);
    await page.getByLabel('Password').fill(STUDENT.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/login');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
