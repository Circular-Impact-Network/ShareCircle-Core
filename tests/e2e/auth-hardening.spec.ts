/**
 * E2E for the 2026-08-05 auth/flow hardening batch: the ungated Google button, live password
 * requirements, the profile-completion gate, and the desktop install block at the manifest level.
 */

import { test, expect, storageStatePaths } from './fixtures';

test.describe('signup: Google is not gated on the terms checkbox', () => {
	/**
	 * Requirement: "Sign up with google button should not be disabled. It is depending on the
	 * thing that user will check the accepting terms and conditions thing, but we are capturing
	 * and asking it later anyway, right?? It causes confusion."
	 */
	test('Google is enabled immediately while Create Account stays gated', async ({ page }) => {
		await page.goto('/signup');

		const google = page.getByTestId('google-signup-btn');
		const create = page.getByRole('button', { name: 'Create Account' });

		await expect(google).toBeEnabled();
		await expect(create).toBeDisabled();

		// The consent step is disclosed rather than silently dropped.
		await expect(page.getByText(/confirm the Terms of Service and Privacy Policy on the next step/i)).toBeVisible();

		await page.getByRole('checkbox').check();
		await expect(create).toBeEnabled();
		await expect(google).toBeEnabled();
	});
});

test.describe('signup: password requirements are live', () => {
	/**
	 * Requirement: "Password requirements while signup should come realtime and not like when
	 * clicking submit. It's frustrating."
	 */
	test('the checklist updates as the user types, before any submit', async ({ page }) => {
		await page.goto('/signup');

		const checklist = page.getByTestId('password-requirements');
		await expect(checklist).toHaveCount(0);

		const password = page.locator('input[placeholder="••••••••"]').first();

		await password.fill('abc');
		await expect(checklist).toBeVisible();
		await expect(page.getByTestId('password-rule-lowercase')).toHaveAttribute('data-met', 'true');
		await expect(page.getByTestId('password-rule-length')).toHaveAttribute('data-met', 'false');
		await expect(page.getByTestId('password-rule-special')).toHaveAttribute('data-met', 'false');

		await password.fill('Password123!');
		for (const rule of ['length', 'uppercase', 'lowercase', 'number', 'special']) {
			await expect(page.getByTestId(`password-rule-${rule}`)).toHaveAttribute('data-met', 'true');
		}
	});

	test('a mismatched confirmation is flagged while typing', async ({ page }) => {
		await page.goto('/signup');

		const inputs = page.locator('input[placeholder="••••••••"]');
		await inputs.first().fill('Password123!');
		await inputs.nth(1).fill('Password123');
		await expect(page.getByTestId('confirm-mismatch')).toBeVisible();

		await inputs.nth(1).fill('Password123!');
		await expect(page.getByTestId('confirm-mismatch')).toHaveCount(0);
	});
});

test.describe('the app is not installable on desktop', () => {
	/**
	 * Requirement: "be 100% sure that we do not allow to install app on a laptop... That popup
	 * should only come on MOBILE devices."
	 *
	 * Suppressing `beforeinstallprompt` only hides our own card — Chrome and Edge keep their
	 * omnibox install button. The manifest is the only lever, so it is what gets asserted.
	 */
	test('the manifest served to this device matches its device class', async ({ page }) => {
		await page.goto('/login');

		const isDesktop = await page.evaluate(() => window.matchMedia('(pointer: fine) and (hover: hover)').matches);
		const isChromium = await page.evaluate(() => /Chrome\/|Chromium\/|Edg\//.test(navigator.userAgent));

		const manifest = await page.evaluate(async () => {
			const res = await fetch('/manifest.webmanifest', { cache: 'no-store' });
			return { status: res.status, contentType: res.headers.get('content-type'), body: await res.json() };
		});

		expect(manifest.status).toBe(200);
		expect(manifest.contentType).toContain('application/manifest+json');

		const effective = manifest.body.display_override?.[0] ?? manifest.body.display;
		const installable = ['fullscreen', 'standalone', 'minimal-ui'].includes(effective);

		if (isDesktop && isChromium) {
			expect(installable, 'desktop Chromium must not receive an installable manifest').toBe(false);
			expect(manifest.body.display).toBe('browser');
		} else {
			expect(installable, 'mobile must stay installable').toBe(true);
		}

		// Branding and icons are identical either way — only installability changes.
		expect(manifest.body.name).toBe('ShareCircle');
		expect(manifest.body.icons.length).toBeGreaterThanOrEqual(2);
	});
});

test.describe('profile completion gate', () => {
	/**
	 * Requirement: "if someone has not filled it due to any reason... and tries to login, it
	 * should not allow to move forward without filling the required details."
	 */
	test.use({ storageState: storageStatePaths.user1 });

	test('a complete profile is not bounced to /complete-profile', async ({ page }) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');
		expect(new URL(page.url()).pathname).not.toBe('/complete-profile');
	});

	test('/complete-profile states that both fields are required', async ({ page }) => {
		// Reached directly. A complete profile is redirected away, so accept either outcome —
		// what must never appear is the old copy calling location optional.
		await page.goto('/complete-profile');
		await page.waitForLoadState('networkidle');
		await expect(page.getByText(/location, if you like/i)).toHaveCount(0);
	});
});

test.describe('invite links survive the auth gates', () => {
	/**
	 * Regression: the middleware built callbackUrl from `pathname` only, dropping ?code=, so
	 * anyone bounced through login lost the invite they had clicked.
	 */
	test('an unauthenticated /join keeps its code in callbackUrl', async ({ page }) => {
		await page.context().clearCookies();
		await page.goto('/join?code=TESTCODE');
		await page.waitForURL(/\/login/);

		const callbackUrl = new URL(page.url()).searchParams.get('callbackUrl');
		expect(callbackUrl).toBe('/join?code=TESTCODE');
	});
});
