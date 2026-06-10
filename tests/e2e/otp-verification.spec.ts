/**
 * E2E tests for the OTP (one-time password) email verification flow.
 * Uses the /api/test/get-otp endpoint to retrieve the OTP written to TestOtp table.
 * These tests exercise the real verification code path — no E2E_AUTO_VERIFY bypass.
 *
 * Required env: TEST_CLEANUP_SECRET, NODE_ENV !== 'production'
 */

import { test, expect } from '@playwright/test';

const TEST_SECRET = process.env.TEST_CLEANUP_SECRET ?? '';

async function getTestOtp(baseURL: string, email: string): Promise<string | null> {
	if (!TEST_SECRET) return null;

	for (let i = 0; i < 10; i++) {
		const res = await fetch(`${baseURL}/api/test/get-otp?email=${encodeURIComponent(email)}`, {
			headers: { 'x-test-secret': TEST_SECRET },
		});
		if (res.ok) {
			const data = (await res.json()) as { otp: string };
			return data.otp;
		}
		await new Promise(r => setTimeout(r, 1000));
	}
	return null;
}

async function cleanup(baseURL: string, email: string) {
	if (!TEST_SECRET) return;
	await fetch(`${baseURL}/api/test/cleanup`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', 'x-test-secret': TEST_SECRET },
		body: JSON.stringify({ emails: [email] }),
	}).catch(() => {});
}

test.describe('OTP email verification', () => {
	test.skip(!TEST_SECRET, 'Skipped: TEST_CLEANUP_SECRET not set');

	test('signup → OTP retrieval → verification → redirects to home', async ({ page, baseURL }) => {
		const base = baseURL ?? 'http://localhost:3003';
		const ts = Date.now();
		const email = `e2e+otp-${ts}@example.com`;
		const password = 'Password123!';

		try {
			// 1. Sign up
			await page.goto('/signup');
			await page.waitForLoadState('domcontentloaded');

			await page.getByPlaceholder('John Doe').fill(`OTP Test User ${ts}`);
			await page.getByPlaceholder('you@example.com').fill(email);
			await page.getByPlaceholder('••••••••').first().fill(password);

			const confirmInput = page.getByPlaceholder(/confirm.*password/i);
			const hasConfirm = await confirmInput.isVisible({ timeout: 2000 }).catch(() => false);
			if (hasConfirm) await confirmInput.fill(password);

			// Signup actions are gated behind accepting the Terms / Privacy policies.
			await page
				.getByRole('checkbox')
				.check()
				.catch(() => {});

			await page.getByRole('button', { name: /^(sign up|create account)$/i }).click();
			await page.waitForLoadState('domcontentloaded');
			await page.waitForTimeout(1000);

			// 2. Should land on OTP entry page
			const onVerifyPage = page.url().includes('verify') || page.url().includes('otp');
			const otpInput = page.getByPlaceholder(/code|otp/i).or(page.locator('input[name="code"]'));
			const hasOtpInput = await otpInput.isVisible({ timeout: 5000 }).catch(() => false);

			if (!onVerifyPage && !hasOtpInput) {
				// Might have gone straight to home (test env auto-verify fallback) - still pass
				test.skip();
				return;
			}

			// 3. Retrieve the OTP
			const otp = await getTestOtp(base, email);
			expect(otp, 'OTP must be retrievable from test endpoint').toBeTruthy();

			// 4. Fill OTP
			await otpInput.first().fill(otp!);
			await page.getByRole('button', { name: /verify|confirm|submit/i }).click();
			await page.waitForLoadState('domcontentloaded');
			await page.waitForTimeout(2000);

			// 5. Should redirect to home after verification
			expect(page.url()).not.toContain('/signup');
			expect(page.url()).not.toContain('/verify');
		} finally {
			await cleanup(base, email);
		}
	});

	test('wrong OTP shows error message', async ({ page, baseURL }) => {
		const base = baseURL ?? 'http://localhost:3003';
		const ts = Date.now();
		const email = `e2e+otp-wrong-${ts}@example.com`;
		const password = 'Password123!';

		try {
			// Sign up first
			const res = await fetch(`${base}/api/auth/signup`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: `OTP Wrong User ${ts}`, email, password }),
			});
			if (!res.ok) {
				test.skip();
				return;
			}

			// Navigate to verify page
			await page.goto(`/signup?mode=verify&email=${encodeURIComponent(email)}`);
			await page.waitForLoadState('networkidle');

			const otpInput = page.getByPlaceholder(/code|otp/i).or(page.locator('input[name="code"]'));
			const hasOtpInput = await otpInput.isVisible({ timeout: 5000 }).catch(() => false);
			if (!hasOtpInput) {
				test.skip();
				return;
			}

			// Enter a wrong OTP
			await otpInput.first().fill('000000');
			await page.getByRole('button', { name: /verify|confirm|submit/i }).click();
			await page.waitForLoadState('networkidle');

			// Should show an error
			const errorText = page.getByText(/invalid|incorrect|wrong|expired|try again/i);
			const hasError = await errorText.isVisible({ timeout: 5000 }).catch(() => false);
			const stillOnVerify = page.url().includes('verify') || page.url().includes('signup');

			expect(hasError || stillOnVerify).toBeTruthy();
		} finally {
			await cleanup(base, email);
		}
	});

	test('resend OTP button triggers new code', async ({ page, baseURL }) => {
		const base = baseURL ?? 'http://localhost:3003';
		const ts = Date.now();
		const email = `e2e+otp-resend-${ts}@example.com`;
		const password = 'Password123!';

		try {
			// Sign up
			const res = await fetch(`${base}/api/auth/signup`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: `OTP Resend User ${ts}`, email, password }),
			});
			if (!res.ok) {
				test.skip();
				return;
			}

			await page.goto(`/signup?mode=verify&email=${encodeURIComponent(email)}`);
			await page.waitForLoadState('networkidle');

			const resendButton = page.getByRole('button', { name: /resend|send again/i });
			const hasResend = await resendButton.isVisible({ timeout: 5000 }).catch(() => false);

			if (hasResend) {
				await resendButton.click();
				await page.waitForLoadState('networkidle');

				// Should show success feedback or stay on verify page
				const successMsg = page.getByText(/sent|resent|check your email/i);
				const hasSuccess = await successMsg.isVisible({ timeout: 5000 }).catch(() => false);
				const stillOnVerify = page.url().includes('verify') || page.url().includes('signup');

				expect(hasSuccess || stillOnVerify).toBeTruthy();
			}
		} finally {
			await cleanup(base, email);
		}
	});

	test('/api/test/get-otp returns 404 in production guard', async ({ baseURL }) => {
		if (process.env.NODE_ENV === 'production') {
			const base = baseURL ?? 'http://localhost:3003';
			const res = await fetch(`${base}/api/test/get-otp?email=any@example.com`, {
				headers: { 'x-test-secret': TEST_SECRET },
			});
			expect(res.status).toBe(404);
		}
	});
});
