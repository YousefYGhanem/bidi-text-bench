import { defineConfig, devices } from '@playwright/test';

// Viewports from docs/CHECKER_SPEC.md §7.
const desktop = { width: 1280, height: 800 };
const mobile = { width: 390, height: 844 };
const browsers = [
  ['chromium', 'Desktop Chrome'],
  ['firefox', 'Desktop Firefox'],
  ['webkit', 'Desktop Safari'],
] as const;

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: { locale: 'en-US', timezoneId: 'UTC' },
  projects: browsers.flatMap(([name, device]) => [
    { name, use: { ...devices[device], viewport: desktop } },
    { name: `${name}-mobile`, use: { ...devices[device], viewport: mobile } },
  ]),
});
