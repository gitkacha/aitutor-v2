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
  // Milestone 2: a setup project logs the seeded e2e users in and saves their sessions;
  // the main project runs every spec as the e2e student by default. Admin-only flows
  // opt into e2e/.auth/admin.json via test.use; auth specs opt out with an empty state.
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'e2e',
      testIgnore: /auth\.setup\.ts/,
      dependencies: ['setup'],
      use: { storageState: 'e2e/.auth/student.json' },
    },
  ],
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
