import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3003';
// Skip the local server when targeting a remote deployment (smoke-staging, smoke-production).
const isRemoteTarget = !!process.env.PLAYWRIGHT_BASE_URL && !process.env.PLAYWRIGHT_BASE_URL.includes('localhost');

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
	...(isRemoteTarget
		? {}
		: {
				webServer: {
					// CI: serve the production build (npm run build runs first in ci.yml).
					// Local: dev server with HMR.
					//
					// `next start` directly, NOT `npm run start`, and only here. `npm start` fires
					// the `prestart` hook -> `prisma migrate deploy`, which connects over
					// DIRECT_URL. Supabase's direct endpoint (db.<ref>.supabase.co:5432) resolves
					// to IPv6 only and GitHub-hosted runners are IPv4-only, so that connection
					// cannot succeed and the web server failed to boot with P1001. The CI database
					// is already migrated, so there is nothing for it to do here anyway. Deploy
					// targets that boot with `npm start` still get migrations applied.
					command: process.env.CI ? 'npx next start -p 3003' : 'npm run dev',
					url: baseURL,
					reuseExistingServer: !process.env.CI, // Always start fresh in CI; reuse locally for speed.
					timeout: 120_000,
					// Spread full env so DATABASE_URL / NEXTAUTH_SECRET / Supabase keys reach the Next.js process.
					// Without this, the webServer only gets the explicit keys and DB queries fail.
					env: {
						...(process.env as Record<string, string>),
						SKIP_SMS: process.env.SKIP_SMS ?? 'true',
						SKIP_EMAIL: process.env.SKIP_EMAIL ?? 'true',
					},
				},
			}),
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] },
		},
		{
			name: 'mobile-chrome',
			use: { ...devices['Pixel 5'] },
		},
	],
});
