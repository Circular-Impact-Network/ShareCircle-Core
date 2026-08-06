import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Guards the email escape hatches.
 *
 * SKIP_EMAIL used to be honoured in production, where it made the signup API report
 * `emailSent: true` while sending nothing — users then waited forever on a verification code
 * that never existed. It must be development-only.
 *
 * lib/email.ts reads process.env at call time, so each case re-imports with a fresh module
 * registry.
 */

const ORIGINAL_ENV = { ...process.env };

async function loadEmailModule() {
	vi.resetModules();
	return import('@/lib/email');
}

describe('email configuration', () => {
	beforeEach(() => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		delete process.env.RESEND_API_KEY;
		delete process.env.SKIP_EMAIL;
		delete process.env.E2E_AUTO_VERIFY;
		delete process.env.EMAIL_FROM;
	});

	afterEach(() => {
		process.env = { ...ORIGINAL_ENV };
		vi.restoreAllMocks();
	});

	it('is configured when an API key is present', async () => {
		vi.stubEnv('NODE_ENV', 'production');
		process.env.RESEND_API_KEY = 're_test';

		const { isEmailConfigured } = await loadEmailModule();
		expect(isEmailConfigured()).toBe(true);
	});

	it('is not configured without an API key', async () => {
		vi.stubEnv('NODE_ENV', 'production');

		const { isEmailConfigured } = await loadEmailModule();
		expect(isEmailConfigured()).toBe(false);
	});

	it('honours SKIP_EMAIL in development', async () => {
		vi.stubEnv('NODE_ENV', 'development');
		process.env.RESEND_API_KEY = 're_test';
		process.env.SKIP_EMAIL = 'true';

		const { isEmailConfigured } = await loadEmailModule();
		expect(isEmailConfigured()).toBe(false);
	});

	it('IGNORES SKIP_EMAIL in production', async () => {
		vi.stubEnv('NODE_ENV', 'production');
		process.env.RESEND_API_KEY = 're_test';
		process.env.SKIP_EMAIL = 'true';

		const { isEmailConfigured } = await loadEmailModule();

		// The regression this file exists for.
		expect(isEmailConfigured()).toBe(true);
		expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/SKIP_EMAIL.*production.*ignored/i));
	});

	it('honours E2E_AUTO_VERIFY in development only', async () => {
		vi.stubEnv('NODE_ENV', 'development');
		process.env.RESEND_API_KEY = 're_test';
		process.env.E2E_AUTO_VERIFY = 'true';
		expect((await loadEmailModule()).isEmailConfigured()).toBe(false);

		vi.stubEnv('NODE_ENV', 'production');
		expect((await loadEmailModule()).isEmailConfigured()).toBe(true);
	});
});

describe('sender address', () => {
	afterEach(() => {
		process.env = { ...ORIGINAL_ENV };
		vi.resetModules();
	});

	it('defaults to the verified no-reply address on the configured domain', async () => {
		delete process.env.EMAIL_FROM;
		const { EMAIL_FROM } = await loadEmailModule();
		expect(EMAIL_FROM).toBe('ShareCircle <no-reply@circularimpact.org>');
	});

	it('can be overridden by EMAIL_FROM', async () => {
		process.env.EMAIL_FROM = 'Other <hello@example.com>';
		const { EMAIL_FROM } = await loadEmailModule();
		expect(EMAIL_FROM).toBe('Other <hello@example.com>');
	});
});
