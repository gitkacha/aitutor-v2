import { test as setup, expect, request } from '@playwright/test';

// Milestone 2 harness: logs the seeded e2e users in once and saves their sessions as
// storageState files. The main test project defaults to the student session so every
// spec runs authenticated (playwright.config.ts); admin-specific flows opt into
// e2e/.auth/admin.json with test.use.

const users = [
  { file: 'e2e/.auth/student.json', email: 'e2e-student@test.local' },
  { file: 'e2e/.auth/admin.json', email: 'e2e-admin@test.local' },
];

setup('authenticate e2e users', async ({ baseURL }) => {
  for (const u of users) {
    const ctx = await request.newContext({ baseURL });
    const res = await ctx.post('/api/auth/login', {
      data: { email: u.email, password: 'test1234' },
    });
    expect(res.ok(), `login for ${u.email} must succeed`).toBeTruthy();
    await ctx.storageState({ path: u.file });
    await ctx.dispose();
  }
});
