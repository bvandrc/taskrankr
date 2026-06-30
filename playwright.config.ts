import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

try {
  process.loadEnvFile('.env.local')
} catch {
  // file is optional; missing is fine (e.g. CI provides env vars directly)
}

const CCR_CHROMIUM = '/opt/pw-browsers/chromium'

const PORT = process.env.PORT || 5000
const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : `http://localhost:${PORT}`)

export default defineConfig({
  testDir: './playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0, // process.env.CI ? 2 : 0,
  reporter: [['html', { outputFolder: 'playwright/results/html' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: existsSync(CCR_CHROMIUM) ? CCR_CHROMIUM : undefined,
    },
  },
  projects: [
    {
      name: 'setup',
      testMatch: /setup\/.*\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'user',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'guest',
      testMatch: /e2e\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
