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
		// CI: use the production build (npm run build runs first in ci.yml); Local: dev server with HMR.
		command: process.env.CI ? 'npm run start' : 'npm run dev',
		url: baseURL,
		reuseExistingServer: !process.env.CI, // Always start fresh in CI; reuse locally for speed.
		timeout: 120_000,
		// Spread full env so DATABASE_URL / NEXTAUTH_SECRET / Supabase keys reach the Next.js process.
		// Without this, the webServer only gets the explicit keys and DB queries fail.
		env: {
			...(process.env as Record<string, string>),
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
