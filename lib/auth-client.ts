'use client';

import { signIn, type SignInResponse } from 'next-auth/react';

/**
 * How long to wait on next-auth's signIn() before treating the sign-in as done and
 * navigating anyway.
 *
 * next-auth's `signIn(..., { redirect: false })` resolves in two steps: the credentials
 * callback sets the session cookie on its response, and only *then* does next-auth await
 * GET /api/auth/session to build the returned object. Our jwt callback reads the DB with
 * retry/backoff, so on a cold serverless start that second step can take tens of seconds.
 * The user is fully signed in the whole time — they just watch a spinner, which is what
 * produced both "stuck on Verifying…" and the illusion that reloading logged them in
 * without verifying.
 *
 * Capping the wait is safe: the cookie is already set, and middleware re-validates the
 * session on arrival, so a stale or absent session simply bounces back to /login.
 */
export const SIGN_IN_TIMEOUT_MS = 4000;

export type SignInOutcome = SignInResponse | 'timeout' | undefined;

/**
 * True when the caller should navigate: either a real success, or a timeout after the cookie
 * was set.
 *
 * `ok` alone is not sufficient. When `authorize()` throws, next-auth's callback endpoint still
 * responds 200 — so `ok` is true while `error` carries the message. Both must be checked or a
 * rejected credential reads as a successful sign-in.
 */
export function shouldNavigateAfterSignIn(outcome: SignInOutcome): boolean {
	if (outcome === 'timeout') {
		return true;
	}
	return Boolean(outcome?.ok && !outcome.error);
}

/** The error string from a failed sign-in, or undefined on success/timeout. */
export function signInError(outcome: SignInOutcome): string | undefined {
	if (!outcome || outcome === 'timeout') {
		return undefined;
	}
	return outcome.error ?? undefined;
}

/**
 * `signIn('credentials', { ...credentials, redirect: false })` with a bounded wait.
 * Resolves to `'timeout'` rather than hanging. Never rejects.
 */
export async function signInWithTimeout(
	credentials: Record<string, string>,
	timeoutMs: number = SIGN_IN_TIMEOUT_MS,
): Promise<SignInOutcome> {
	let timer: ReturnType<typeof setTimeout> | undefined;

	try {
		return await Promise.race<SignInOutcome>([
			signIn('credentials', { ...credentials, redirect: false }),
			new Promise<'timeout'>(resolve => {
				timer = setTimeout(() => resolve('timeout'), timeoutMs);
			}),
		]);
	} finally {
		if (timer) {
			clearTimeout(timer);
		}
	}
}
