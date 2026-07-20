import { Page } from '@playwright/test';

// W-16: timed screens now open on a "Ready to start?" confirmation. Click through it so
// specs reach the running test. Safe to call whether or not the gate is present.
export async function startTest(page: Page) {
  const startBtn = page.getByRole('button', { name: 'Start test' });
  await startBtn.click();
}
