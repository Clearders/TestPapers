import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  outputDir: 'output/playwright/test-results',
  reporter: [
    ['line'],
    ['junit', { outputFile: 'output/playwright/junit.xml' }],
    ['html', { outputFolder: 'output/playwright/html', open: 'never' }]
  ],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 3000',
    url: `${baseURL}/api/v1/health/postgres`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      TESTPAPERS_ENV: 'test',
      NUXT_API_BASE: process.env.NUXT_API_BASE || 'http://127.0.0.1:8001/api/v1',
      NUXT_PUBLIC_API_BASE: '/api/v1',
      NUXT_PUBLIC_DIRECT_API_BASE: ''
    }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
