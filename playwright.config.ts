import { defineConfig } from '@playwright/test';

// E2E stack runs on its own ports and its own SQLite database (backend/prisma/e2e.db),
// so it never collides with the dev servers on 3001/5173 or touches dev data.
export default defineConfig({
  testDir: './e2e',
  workers: 1, // tests share one seeded database — keep them serial
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5273',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run e2e:backend',
      url: 'http://localhost:3105/api/health',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npm run e2e:frontend',
      url: 'http://localhost:5273',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
