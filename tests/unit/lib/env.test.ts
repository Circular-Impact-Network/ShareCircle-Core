import { describe, expect, it } from 'vitest';
import { checkEnv } from '@/lib/env';

const COMPLETE = {
	DATABASE_URL: 'postgresql://user:pass@host:5432/db',
	NEXTAUTH_SECRET: 'a-secret',
	NEXTAUTH_URL: 'https://sharecircle.example',
	NEXT_PUBLIC_SUPABASE_URL: 'https://proj.supabase.co',
	NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
	SUPABASE_SERVICE_ROLE_KEY: 'service',
	SUPABASE_JWT_SECRET: 'jwt',
	DIRECT_URL: 'postgresql://user:pass@host:5432/db',
	RESEND_API_KEY: 'resend',
	VAPID_PUBLIC_KEY: 'pub',
	VAPID_PRIVATE_KEY: 'priv',
} as unknown as NodeJS.ProcessEnv;

/**
 * These assertions are about deploy-time feedback, not about zod. Twenty-five environment
 * variables were read across the app with nothing checking any of them, so a missing one first
 * announced itself as a 500 on whichever user request happened to touch it.
 */
describe('checkEnv', () => {
	it('passes on a complete environment', () => {
		expect(checkEnv(COMPLETE)).toEqual({ ok: true, missing: [], warnings: [] });
	});

	it('reports every missing required variable at once, not just the first', () => {
		const result = checkEnv({ ...COMPLETE, NEXTAUTH_SECRET: undefined, SUPABASE_JWT_SECRET: undefined });

		expect(result.ok).toBe(false);
		expect(result.missing).toHaveLength(2);
		expect(result.missing.join(' ')).toContain('NEXTAUTH_SECRET');
		expect(result.missing.join(' ')).toContain('SUPABASE_JWT_SECRET');
	});

	it('rejects a NEXTAUTH_URL that is not absolute', () => {
		const result = checkEnv({ ...COMPLETE, NEXTAUTH_URL: 'localhost:3003' });
		expect(result.ok).toBe(false);
		expect(result.missing.join(' ')).toContain('NEXTAUTH_URL');
	});

	/**
	 * SUPABASE_JWT_SECRET is required rather than recommended because without it the realtime
	 * token endpoint 500s and every private channel is refused — the app looks healthy and
	 * silently stops delivering messages.
	 */
	it('treats SUPABASE_JWT_SECRET as required, not optional', () => {
		const result = checkEnv({ ...COMPLETE, SUPABASE_JWT_SECRET: undefined });
		expect(result.ok).toBe(false);
		expect(result.warnings.join(' ')).not.toContain('SUPABASE_JWT_SECRET');
	});

	it('warns without failing when an optional feature key is absent', () => {
		const result = checkEnv({ ...COMPLETE, RESEND_API_KEY: undefined });
		expect(result.ok).toBe(true);
		expect(result.warnings.join(' ')).toContain('RESEND_API_KEY');
	});

	it('never echoes a value, only the variable name', () => {
		const result = checkEnv({ ...COMPLETE, NEXTAUTH_URL: 'not-a-url-but-secret-looking' });
		expect(JSON.stringify(result)).not.toContain('not-a-url-but-secret-looking');
	});
});
