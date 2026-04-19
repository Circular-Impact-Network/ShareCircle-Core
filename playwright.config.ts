import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3003';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	retries: 2, // Retry failed tests to handle rate limiting/flaky tests in parallel runs
	timeout: 60_000,
	expect: {
		timeout: 10_000,
	},
	reporter: [['html', { open: 'never' }], ['list']],
	use: {
		baseURL,
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
	},
	globalSetup: path.join(__dirname, 'tests/e2e/global-setup.ts'),
	globalTeardown: path.join(__dirname, 'tests/e2e/global-teardown.ts'),
	webServer: {
		command: 'npm run dev',
		url: baseURL,
		reuseExistingServer: true, // Allow reusing existing server for local development
		timeout: 120_000,
		// Inherit full env (CI sets DATABASE_URL from secrets; Next also reads .env.local locally).
		// Do not replace with a tiny object only — that can drop DATABASE_URL for the dev server.
		env: {
			...process.env,
			E2E_AUTO_VERIFY: process.env.E2E_AUTO_VERIFY ?? 'true',
			SKIP_SMS: process.env.SKIP_SMS ?? 'true',
			SKIP_EMAIL: process.env.SKIP_EMAIL ?? 'true',
		},
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
});
