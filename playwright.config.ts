import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

// Runs against the production build (`npm run build` first), not the dev server,
// so the test sees the same HTML, CSP and island hydration that ships.
export default defineConfig({
  testDir: 'tests',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // --ignore-lock keeps Astro in the foreground. Without it, Astro 7 backgrounds the
    // preview server when it detects an AI agent, and Playwright can't shut it down.
    command: 'npm run preview -- --port 4321 --ignore-lock',
    url: 'http://localhost:4321',
    reuseExistingServer: !isCI,
  },
});
