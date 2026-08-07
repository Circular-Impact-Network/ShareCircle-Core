import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const getServerSession = vi.fn();
const findFirst = vi.fn();

vi.mock('next-auth', () => ({ getServerSession: (...args: unknown[]) => getServerSession(...args) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/prisma', () => ({ prisma: { circleMember: { findFirst: (...a: unknown[]) => findFirst(...a) } } }));

const { parseBody, requireCircleAdmin, requireCircleMember, requireUser } = await import('@/lib/api-guards');

function jsonRequest(body: unknown): Request {
	return new Request('https://example.test/api/thing', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: typeof body === 'string' ? body : JSON.stringify(body),
	});
}

describe('requireUser', () => {
	beforeEach(() => getServerSession.mockReset());

	it('yields the caller id for a signed-in session', async () => {
		getServerSession.mockResolvedValue({ user: { id: 'u1' } });
		const result = await requireUser();
		expect(result).toEqual({ ok: true, data: { userId: 'u1' } });
	});

	it('401s when there is no session', async () => {
		getServerSession.mockResolvedValue(null);
		const result = await requireUser();
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.response.status).toBe(401);
	});

	/**
	 * The revoked-session path. `session()` blanks the user id rather than throwing, so a guard
	 * that only checked for the presence of `session.user` would wave a revoked token straight
	 * through — which is the entire point of the revocation.
	 */
	it('401s when the session carries a blank id', async () => {
		getServerSession.mockResolvedValue({ user: { id: '' } });
		const result = await requireUser();
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.response.status).toBe(401);
	});
});

describe('requireCircleMember', () => {
	beforeEach(() => findFirst.mockReset());

	it('admits an active member and reports their role', async () => {
		findFirst.mockResolvedValue({ role: 'MEMBER' });
		const result = await requireCircleMember('c1', 'u1');
		expect(result).toEqual({ ok: true, data: { role: 'MEMBER' } });
	});

	/**
	 * The clause worth centralising. A member who leaves keeps their row, so a query that omits
	 * `leftAt: null` keeps serving circle contents to someone who has left. It was written out by
	 * hand in nineteen places.
	 */
	it('always constrains the lookup to memberships that have not been left', async () => {
		findFirst.mockResolvedValue({ role: 'MEMBER' });
		await requireCircleMember('c1', 'u1');
		expect(findFirst).toHaveBeenCalledWith(
			expect.objectContaining({ where: { circleId: 'c1', userId: 'u1', leftAt: null } }),
		);
	});

	it('404s rather than 403s for a non-member, so circle existence is not disclosed', async () => {
		findFirst.mockResolvedValue(null);
		const result = await requireCircleMember('c1', 'outsider');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.response.status).toBe(404);
	});
});

describe('requireCircleAdmin', () => {
	beforeEach(() => findFirst.mockReset());

	it('admits an admin', async () => {
		findFirst.mockResolvedValue({ role: 'ADMIN' });
		expect((await requireCircleAdmin('c1', 'u1')).ok).toBe(true);
	});

	it('403s a plain member', async () => {
		findFirst.mockResolvedValue({ role: 'MEMBER' });
		const result = await requireCircleAdmin('c1', 'u1');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.response.status).toBe(403);
	});

	it('404s a non-member without leaking that the circle exists', async () => {
		findFirst.mockResolvedValue(null);
		const result = await requireCircleAdmin('c1', 'outsider');
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.response.status).toBe(404);
	});
});

describe('parseBody', () => {
	const schema = z.object({ name: z.string().min(1), count: z.number().int().optional() });

	it('returns the parsed value on a valid body', async () => {
		const result = await parseBody(jsonRequest({ name: 'ok', count: 2 }), schema);
		expect(result).toEqual({ ok: true, data: { name: 'ok', count: 2 } });
	});

	/**
	 * Previously a truncated or empty body threw out of `await req.json()` and escaped as a 500 —
	 * a client mistake reported as a server fault, and noise in any error budget.
	 */
	it('400s on malformed JSON instead of throwing', async () => {
		const result = await parseBody(jsonRequest('{not json'), schema);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.response.status).toBe(400);
	});

	it('400s and names the offending field', async () => {
		const result = await parseBody(jsonRequest({ count: 2 }), schema);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.response.status).toBe(400);
			expect((await result.response.json()).error).toContain('name');
		}
	});

	it('strips properties the schema does not declare', async () => {
		const result = await parseBody(jsonRequest({ name: 'ok', isAdmin: true }), schema);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.data).not.toHaveProperty('isAdmin');
	});
});
