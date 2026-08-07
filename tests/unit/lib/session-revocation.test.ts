import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWT } from 'next-auth/jwt';

const findUnique = vi.fn();

vi.mock('@/lib/prisma', () => ({
	prisma: { user: { findUnique: (...a: unknown[]) => findUnique(...a), update: vi.fn() } },
}));

const { authOptions } = await import('@/lib/auth');

type JwtArgs = Parameters<NonNullable<NonNullable<typeof authOptions.callbacks>['jwt']>>[0];
const jwt = (args: Partial<JwtArgs>) => authOptions.callbacks!.jwt!({ token: { id: 'u1' } as JWT, ...args } as JwtArgs);
const session = (token: JWT) =>
	authOptions.callbacks!.session!({
		token,
		session: { user: { id: 'u1', email: 'a@b.c' }, expires: '2099-01-01T00:00:00.000Z' },
	} as never);

const COMPLETE_USER = {
	emailVerified: new Date('2026-01-01'),
	date_of_birth: new Date('1990-01-01'),
	city: 'Bengaluru',
	password_changed_at: null as Date | null,
};

/**
 * Sessions are JWTs, so nothing server-side can revoke one: the token is valid until it expires.
 * That meant changing a password did nothing to an already-stolen session — the single action a
 * compromised user takes to protect themselves had no effect for the remaining life of the token.
 *
 * These tests pin the replacement: the token carries the `password_changed_at` it was minted
 * under, is re-read from the database at most every few minutes, and is refused once the database
 * value moves ahead of it.
 */
describe('session revocation on password change', () => {
	beforeEach(() => {
		findUnique.mockReset();
		findUnique.mockResolvedValue({ ...COMPLETE_USER });
	});

	it('baselines the stamp at sign-in', async () => {
		const changedAt = new Date('2026-08-01T10:00:00Z');
		findUnique.mockResolvedValue({ ...COMPLETE_USER, password_changed_at: changedAt });

		const token = await jwt({ trigger: 'signIn', user: { id: 'u1' } as never });

		expect(token.passwordChangedAt).toBe(changedAt.getTime());
		expect(token.sessionRevoked).toBeUndefined();
	});

	it('revokes a token minted before the password changed', async () => {
		findUnique.mockResolvedValue({ ...COMPLETE_USER, password_changed_at: new Date('2026-08-02T10:00:00Z') });

		const token = await jwt({
			token: {
				id: 'u1',
				emailVerified: COMPLETE_USER.emailVerified,
				profileComplete: true,
				profileRuleVersion: 2,
				passwordChangedAt: new Date('2026-08-01T10:00:00Z').getTime(),
				checkedAt: 0, // forces revalidation
			} as JWT,
		});

		expect(token.sessionRevoked).toBe(true);
	});

	it('leaves a token minted after the change alone', async () => {
		const changedAt = new Date('2026-08-01T10:00:00Z');
		findUnique.mockResolvedValue({ ...COMPLETE_USER, password_changed_at: changedAt });

		const token = await jwt({
			token: {
				id: 'u1',
				emailVerified: COMPLETE_USER.emailVerified,
				profileComplete: true,
				profileRuleVersion: 2,
				passwordChangedAt: changedAt.getTime(),
				checkedAt: 0,
			} as JWT,
		});

		expect(token.sessionRevoked).toBeUndefined();
	});

	/**
	 * The actor's own tab calls `update()` after a successful change. Without this re-baseline the
	 * user would be signed out by their own password change, which trains people not to do it.
	 */
	it('re-baselines rather than revokes on an explicit update', async () => {
		const changedAt = new Date('2026-08-02T10:00:00Z');
		findUnique.mockResolvedValue({ ...COMPLETE_USER, password_changed_at: changedAt });

		const token = await jwt({
			trigger: 'update',
			token: {
				id: 'u1',
				emailVerified: COMPLETE_USER.emailVerified,
				profileComplete: true,
				profileRuleVersion: 2,
				passwordChangedAt: new Date('2026-08-01T10:00:00Z').getTime(),
				sessionRevoked: true,
			} as JWT,
		});

		expect(token.sessionRevoked).toBeUndefined();
		expect(token.passwordChangedAt).toBe(changedAt.getTime());
	});

	it('does not query the database again inside the revalidation window', async () => {
		await jwt({
			token: {
				id: 'u1',
				emailVerified: COMPLETE_USER.emailVerified,
				profileComplete: true,
				profileRuleVersion: 2,
				passwordChangedAt: 0,
				checkedAt: Date.now(),
			} as JWT,
		});

		expect(findUnique).not.toHaveBeenCalled();
	});

	it('re-reads once the revalidation window has elapsed', async () => {
		await jwt({
			token: {
				id: 'u1',
				emailVerified: COMPLETE_USER.emailVerified,
				profileComplete: true,
				profileRuleVersion: 2,
				passwordChangedAt: 0,
				checkedAt: Date.now() - 6 * 60_000,
			} as JWT,
		});

		expect(findUnique).toHaveBeenCalledOnce();
	});

	/**
	 * Blanking the id is what makes every existing guard enforce the revocation: API routes
	 * already bail on `!session?.user?.id`, and the authenticated layout already redirects.
	 */
	it('yields an unusable session once revoked', async () => {
		const result = (await session({ id: 'u1', sessionRevoked: true } as JWT)) as {
			user: { id: string };
			expires: string;
		};
		expect(result.user.id).toBe('');
		expect(new Date(result.expires).getTime()).toBeLessThan(Date.now());
	});

	it('yields a normal session when not revoked', async () => {
		const result = (await session({ id: 'u1', emailVerified: null, profileComplete: true } as JWT)) as {
			user: { id: string };
		};
		expect(result.user.id).toBe('u1');
	});

	/**
	 * A user who has never changed their password has a NULL stamp. The migration leaves every
	 * existing row NULL on purpose, so shipping this must not sign the whole userbase out.
	 */
	it('does not revoke accounts that have never changed a password', async () => {
		findUnique.mockResolvedValue({ ...COMPLETE_USER, password_changed_at: null });

		const token = await jwt({
			token: {
				id: 'u1',
				emailVerified: COMPLETE_USER.emailVerified,
				profileComplete: true,
				profileRuleVersion: 2,
				checkedAt: 0,
			} as JWT,
		});

		expect(token.sessionRevoked).toBeUndefined();
	});
});
