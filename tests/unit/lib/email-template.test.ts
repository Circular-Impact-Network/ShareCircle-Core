import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Requirement (2026-08-05): "This is how the email from share circle look like: [screenshot].
 * Please fix it and make it look a little better. Also have proper logo in this."
 *
 * Captures the payload Resend would receive by stubbing fetch, so the real lib/email.ts code
 * path renders the assertions rather than a reimplementation of it.
 */
type Sent = { subject: string; html: string; text?: string; from: string };

const sent: Sent[] = [];
const realFetch = globalThis.fetch;

async function loadEmailModule(env: Record<string, string | undefined>) {
	sent.length = 0;
	vi.resetModules();

	for (const [key, value] of Object.entries(env)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}

	globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
		const target = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
		if (target.includes('api.resend.com')) {
			sent.push(JSON.parse(String(init?.body)));
			return new Response(JSON.stringify({ id: 'stub' }), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			});
		}
		return realFetch(url as never, init);
	}) as typeof fetch;

	return import('@/lib/email');
}

const BASE_ENV = {
	RESEND_API_KEY: 're_test_key',
	SKIP_EMAIL: undefined,
	E2E_AUTO_VERIFY: undefined,
	EMAIL_FROM: undefined,
	NEXTAUTH_URL: 'https://app.sharecircle.test',
	EMAIL_ASSET_BASE_URL: undefined,
};

describe('transactional email template', () => {
	const originalEnv = { ...process.env };

	beforeEach(() => {
		sent.length = 0;
	});

	afterEach(() => {
		globalThis.fetch = realFetch;
		process.env = { ...originalEnv };
		vi.resetModules();
	});

	it('sends from the configured no-reply address on the verified domain', async () => {
		const { sendOTPEmail } = await loadEmailModule(BASE_ENV);
		await sendOTPEmail('user@example.com', '123456', 'login_otp');

		expect(sent).toHaveLength(1);
		expect(sent[0].from).toBe('ShareCircle <no-reply@circularimpact.org>');
	});

	it('embeds the real logo, not a text placeholder', async () => {
		const { sendOTPEmail } = await loadEmailModule(BASE_ENV);
		await sendOTPEmail('user@example.com', '123456', 'login_otp');

		const { html } = sent[0];
		// Absolute URL: mail clients cannot resolve a relative path.
		expect(html).toContain('<img src="https://app.sharecircle.test/email/logo.png"');
		// The wordmark stays as text beside it — most clients block remote images by default,
		// so an image-only header shows an empty box on first open.
		expect(html).toContain('ShareCircle');
		// Regression: the old header rendered a hardcoded "SC" tile instead of the logo.
		expect(html).not.toMatch(/>\s*SC\s*</);
	});

	it('omits the image on localhost rather than shipping a broken-image icon', async () => {
		const { sendOTPEmail } = await loadEmailModule({ ...BASE_ENV, NEXTAUTH_URL: 'http://localhost:3003' });
		await sendOTPEmail('user@example.com', '123456', 'login_otp');

		expect(sent[0].html).not.toContain('<img');
		expect(sent[0].html).toContain('ShareCircle');
	});

	it('lets EMAIL_ASSET_BASE_URL override the derived origin', async () => {
		const { sendOTPEmail } = await loadEmailModule({
			...BASE_ENV,
			NEXTAUTH_URL: 'http://localhost:3003',
			EMAIL_ASSET_BASE_URL: 'https://cdn.example.com/',
		});
		await sendOTPEmail('user@example.com', '123456', 'login_otp');

		// Trailing slash must not double up.
		expect(sent[0].html).toContain('src="https://cdn.example.com/email/logo.png"');
	});

	it('uses table layout only — Outlook ignores flexbox', async () => {
		const { sendOTPEmail } = await loadEmailModule(BASE_ENV);
		await sendOTPEmail('user@example.com', '123456', 'login_otp');

		const { html } = sent[0];
		// The old header used display:inline-flex, which collapsed into stacked text in Outlook.
		expect(html).not.toMatch(/display:\s*(inline-)?flex/);
		expect(html).toContain('role="presentation"');
	});

	it('includes a plain-text alternative for spam scoring', async () => {
		const { sendOTPEmail } = await loadEmailModule(BASE_ENV);
		await sendOTPEmail('user@example.com', '424242', 'login_otp');

		expect(sent[0].text).toBeTruthy();
		expect(sent[0].text).toContain('424242');
		expect(sent[0].text).not.toContain('<');
	});

	it('renders the OTP and its expiry', async () => {
		const { sendOTPEmail } = await loadEmailModule(BASE_ENV);
		await sendOTPEmail('user@example.com', '987654', 'email_verification');

		expect(sent[0].subject).toBe('Verify your email - ShareCircle');
		expect(sent[0].html).toContain('987654');
		expect(sent[0].html).toContain('expires in 10 minutes');
	});

	it('renders the reset link as both a button and copyable text', async () => {
		const { sendPasswordResetEmail } = await loadEmailModule(BASE_ENV);
		await sendPasswordResetEmail('user@example.com', 'tok123');

		const { html, text } = sent[0];
		const resetUrl = 'https://app.sharecircle.test/login?mode=reset&token=tok123';
		expect(html).toContain(`href="${resetUrl}"`);
		// Two occurrences: the button and the copy-paste fallback.
		expect(html.split(resetUrl).length - 1).toBeGreaterThanOrEqual(2);
		expect(text).toContain(resetUrl);
	});

	it('is a complete standalone document with a preview line', async () => {
		const { sendOTPEmail } = await loadEmailModule(BASE_ENV);
		await sendOTPEmail('user@example.com', '123456', 'login_otp');

		const { html } = sent[0];
		expect(html.trimStart().startsWith('<!DOCTYPE')).toBe(true);
		expect(html).toContain('</html>');
		expect(html).toContain('mso-hide:all');
	});

	it('sends nothing when email is suppressed in development', async () => {
		const { sendOTPEmail } = await loadEmailModule({ ...BASE_ENV, SKIP_EMAIL: 'true' });
		await sendOTPEmail('user@example.com', '123456', 'login_otp');
		expect(sent).toHaveLength(0);
	});
});
