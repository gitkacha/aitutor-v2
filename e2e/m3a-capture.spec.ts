import { test, expect } from '@playwright/test';
import { startTest } from './helpers/practice';

// Milestone 3a Task 7: the timed math test silently captures, per question, how long the
// student dwelt on it, which questions they flagged (W-17), and how many times they changed
// their answer — all read back later by the analysis layer. This spec drives a real 2-question
// topic practice through the UI and checks the saved attempt carries all three.

test.describe('M3a — per-question dwell, flags and answer-change capture', () => {
  test('captures dwell time, flags and answer changes for a 2-question practice', async ({ page, request }) => {
    // 'fractions' has exactly two seeded bank questions. Single-topic practice shuffles their
    // order per request (M2), so the spec drives options by position, not by text, and reads
    // back the actual ids from the saved attempt's own `questions` field (display order) rather
    // than assuming which question lands first.
    const sanity = await (await request.get('/api/math/questions?topic=fractions')).json();
    expect(sanity.length, 'fractions must have exactly 2 seed questions for this spec').toBe(2);

    const options = page.locator('div.mt-4.space-y-2 button');

    await page.goto('/math/fractions/start');
    await startTest(page);
    await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible();

    // Dwell on Q1 for a bit before doing anything, then flag it and answer it.
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /^Flag/ }).click();
    await expect(page.getByRole('button', { name: /^(Unflag|Flagged)/ })).toBeVisible();
    await options.nth(0).click();

    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText(/^2 \/ \d+$/)).toBeVisible();

    // Answer Q2, then change the answer once.
    await options.nth(0).click();
    await options.nth(1).click();

    await page.getByRole('button', { name: 'Finish Test' }).click();
    await page.getByRole('button', { name: 'Submit Now' }).click();
    await page.waitForURL(/\/math-attempt\/\d+/);

    const attempts = await (await request.get('/api/math/attempts')).json();
    const newest = attempts[0];
    const [q1Id, q2Id] = JSON.parse(newest.questions);

    expect(newest.questionTimings, 'questionTimings must be captured').not.toBeNull();
    const timings = JSON.parse(newest.questionTimings);
    expect(Object.keys(timings).map(Number).sort((a, b) => a - b)).toEqual([q1Id, q2Id].sort((a, b) => a - b));
    expect(timings[q1Id]).toBeGreaterThan(0);
    expect(timings[q2Id]).toBeGreaterThan(0);

    expect(newest.questionFlags, 'questionFlags must be captured').not.toBeNull();
    expect(JSON.parse(newest.questionFlags)).toEqual([q1Id]);

    expect(newest.answerChanges, 'answerChanges must be captured').not.toBeNull();
    expect(JSON.parse(newest.answerChanges)).toEqual({ [q2Id]: 1 });
  });
});
