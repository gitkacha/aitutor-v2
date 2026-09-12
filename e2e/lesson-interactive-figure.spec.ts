import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// W-130/W-131: lesson figures are interactive (hover a pie slice → its 5%-block breakdown), and a
// card that has a figure never also shows a separate media animation (one visual per card).
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

const PIE =
  '```figure\n{"kind":"pie-chart","title":"Visitors","sectors":[' +
  '{"label":"Children","percent":15,"showPercent":true},' +
  '{"label":"Adults","percent":40,"showPercent":true},' +
  '{"label":"Students","percent":25},{"label":"Seniors","percent":20}]}\n```';
const CONTENT = [
  '## 1. The Selective Trap', 'Spot it.', '',
  '## 2. The Intuitive Building Block', 'Break it into 5% blocks.', '', PIE, '',
  '## 3. The Speed Shortcut', 'Now use the pie: read the 15% slice and scale up.', '',
  '## 4. Guided Quiz', 'Done.',
].join('\n');

async function seed(media?: { mediaKind: string; mediaSvg: string }): Promise<number> {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-admin@test.local' } });
  const skill = await prisma.skill.findFirstOrThrow({ where: { subject: 'math' } });
  const mod = await prisma.coachingModule.create({
    data: { workspaceId: admin.workspaceId, skillId: skill.id, title: 'Interactive Figure', content: CONTENT, status: 'approved', ...(media ?? {}) },
  });
  return mod.id;
}

test.describe('W-130/W-131 — interactive figures + one visual per card', () => {
  test.use({ storageState: 'e2e/.auth/student.json' });
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('hovering a pie slice explains its 5%-block breakdown, and reverts on mouse-out (W-130)', async ({ page }) => {
    const id = await seed();
    await page.goto(`/lesson/${id}`);
    await page.getByRole('button', { name: 'Next' }).click(); // → Building Block card (has the pie)
    await expect(page.getByTestId('stimulus-pie-chart')).toBeVisible();
    await expect(page.getByText(/Hover a slice/)).toBeVisible();

    await page.locator('.recharts-pie-sector').first().hover(); // Children = 15%
    await expect(page.getByText(/15% = 3 blocks of 5%/)).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/w130-interactive-pie.png' });

    await page.getByRole('heading', { name: /Building Block/ }).hover(); // move focus away
    await expect(page.getByText(/Hover a slice/)).toBeVisible();
  });

  test('a card that references the figure shows it too — no back-and-forth (W-132)', async ({ page }) => {
    const id = await seed();
    await page.goto(`/lesson/${id}`);
    await page.getByRole('button', { name: 'Next' }).click(); // → Building Block (has the pie)
    await page.getByRole('button', { name: 'Next' }).click(); // → Speed Shortcut (references the pie)
    await expect(page.getByRole('heading', { name: /Speed Shortcut/ })).toBeVisible();
    // The pie is carried onto this card even though the section has no ```figure of its own.
    await expect(page.getByTestId('stimulus-pie-chart')).toBeVisible();
    // …and it's still interactive here.
    await page.locator('.recharts-pie-sector').first().hover();
    await expect(page.getByText(/15% = 3 blocks of 5%/)).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/w132-carried-figure.png' });
  });

  test('a card with a figure suppresses the media animation — one visual (W-131)', async ({ page }) => {
    const svg = '<svg viewBox="0 0 320 180"><rect width="10" height="10"><animate attributeName="x" from="0" to="10" dur="1s"/></rect></svg>';
    const id = await seed({ mediaKind: 'animation', mediaSvg: svg });
    await page.goto(`/lesson/${id}`);
    await page.getByRole('button', { name: 'Next' }).click(); // → Building Block card
    await expect(page.getByTestId('stimulus-pie-chart')).toBeVisible(); // the figure IS shown
    await expect(page.locator('svg animate')).toHaveCount(0); // the animation is NOT
  });
});
