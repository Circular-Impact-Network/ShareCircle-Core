import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const signIn = vi.fn();
vi.mock('next-auth/react', () => ({ signIn: (...args: unknown[]) => signIn(...args) }));

const { SIGN_IN_TIMEOUT_MS, shouldNavigateAfterSignIn, signInError, signInWithTimeout } =
	await import('@/lib/auth-client');

/**
 * Requirement (2026-08-05): "make sure that they should be super seamless and work without any
 * issues. No code issues, no loading stuck, no code bypassing, no stuck on verifying etc."
 *
 * The hang: `signIn(..., {redirect:false})` sets the session cookie on the credentials callback
 * response, then awaits GET /api/auth/session, whose jwt callback retries the DB with backoff.
 * On a cold start that await runs for tens of seconds while the user is already signed in.
 */
describe('signInWithTimeout', () => {
	beforeEach(() => {
		signIn.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('passes credentials through with redirect disabled', async () => {
		signIn.mockResolvedValue({ ok: true, error: null, status: 200, url: '/home' });

		await signInWithTimeout({ email: 'a@b.com', password: 'pw' });

		expect(signIn).toHaveBeenCalledWith('credentials', {
			email: 'a@b.com',
			password: 'pw',
			redirect: false,
		});
	});

	it('returns the real outcome when signIn resolves in time', async () => {
		signIn.mockResolvedValue({ ok: true, error: null, status: 200, url: '/home' });
		const outcome = await signInWithTimeout({ email: 'a@b.com', password: 'pw' });
		expect(outcome).toMatchObject({ ok: true });
	});

	it('resolves to "timeout" instead of hanging when signIn never settles', async () => {
		vi.useFakeTimers();
		// Never resolves — models the unbounded /api/auth/session await.
		signIn.mockReturnValue(new Promise(() => {}));

		const pending = signInWithTimeout({ email: 'a@b.com', password: 'pw' });
		await vi.advanceTimersByTimeAsync(SIGN_IN_TIMEOUT_MS + 1);

		await expect(pending).resolves.toBe('timeout');
	});

	it('honours a caller-supplied timeout', async () => {
		vi.useFakeTimers();
		signIn.mockReturnValue(new Promise(() => {}));

		const pending = signInWithTimeout({ email: 'a@b.com', password: 'pw' }, 100);
		await vi.advanceTimersByTimeAsync(101);

		await expect(pending).resolves.toBe('timeout');
	});
});

describe('shouldNavigateAfterSignIn', () => {
	it('navigates on a clean success', () => {
		expect(shouldNavigateAfterSignIn({ ok: true, error: null, status: 200, url: '/home' })).toBe(true);
	});

	it('navigates on timeout, because the session cookie is already set', () => {
		expect(shouldNavigateAfterSignIn('timeout')).toBe(true);
	});

	/**
	 * Regression: when authorize() throws, next-auth's callback endpoint still answers 200, so
	 * `ok` is true while `error` carries the message. Checking `ok` alone — which the pre-fix
	 * signup code did — reads a rejected credential as a successful sign-in.
	 */
	it('does not navigate when ok is true but an error is present', () => {
		expect(
			shouldNavigateAfterSignIn({
				ok: true,
				error: 'Email not verified. Please verify your email.',
				status: 200,
				url: null,
			}),
		).toBe(false);
	});

	it('does not navigate on a plain credential rejection', () => {
		expect(shouldNavigateAfterSignIn({ ok: false, error: 'CredentialsSignin', status: 401, url: null })).toBe(
			false,
		);
	});

	it('does not navigate when signIn returned undefined', () => {
		expect(shouldNavigateAfterSignIn(undefined)).toBe(false);
	});
});

describe('signInError', () => {
	it('surfaces the error string so callers can show a specific message', () => {
		expect(signInError({ ok: false, error: 'CredentialsSignin', status: 401, url: null })).toBe(
			'CredentialsSignin',
		);
	});

	it('is undefined for a timeout — a timeout is not a failure', () => {
		expect(signInError('timeout')).toBeUndefined();
	});

	it('is undefined on success and when signIn returned undefined', () => {
		expect(signInError({ ok: true, error: null, status: 200, url: '/home' })).toBeUndefined();
		expect(signInError(undefined)).toBeUndefined();
	});
});
