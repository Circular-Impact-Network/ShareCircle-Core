import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3003';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
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
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
});
