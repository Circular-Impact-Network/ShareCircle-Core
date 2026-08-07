import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { ZodType } from 'zod';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * The three checks nearly every route needs, in one place.
 *
 * Before this, 37 route handlers re-derived the session and its 401 by hand, 19 re-wrote the
 * circle-membership query, and 35 read a JSON body with no schema at all. Duplication that wide
 * is not just noise: it is 19 chances to forget `leftAt: null` and leak a departed member's view
 * of a circle, and 35 handlers whose behaviour on a malformed body is whatever the first property
 * access happens to do.
 *
 * Every helper returns either a value or a `Response`. Callers return the response as-is, so the
 * failure shape is identical everywhere and cannot drift per route.
 */

export type Guarded<T> = { ok: true; data: T } | { ok: false; response: Response };

function deny(status: number, error: string): { ok: false; response: Response } {
	return { ok: false, response: NextResponse.json({ error }, { status }) };
}

/** Resolves the caller, or a 401. */
export async function requireUser(): Promise<Guarded<{ userId: string }>> {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return deny(401, 'Unauthorized');
	}
	return { ok: true, data: { userId: session.user.id } };
}

/**
 * Confirms active membership of a circle, or a 403.
 *
 * `leftAt: null` is the part worth centralising — a member who left keeps their row, so omitting
 * it silently grants a former member continued access.
 */
export async function requireCircleMember(circleId: string, userId: string): Promise<Guarded<{ role: string }>> {
	const membership = await prisma.circleMember.findFirst({
		where: { circleId, userId, leftAt: null },
		select: { role: true },
	});
	if (!membership) {
		// 404 rather than 403 on purpose: a non-member should not be able to distinguish
		// "this circle exists and you are not in it" from "no such circle".
		return deny(404, 'Circle not found');
	}
	return { ok: true, data: { role: membership.role } };
}

/** As above, and additionally requires the ADMIN role. */
export async function requireCircleAdmin(circleId: string, userId: string): Promise<Guarded<{ role: string }>> {
	const member = await requireCircleMember(circleId, userId);
	if (!member.ok) return member;
	if (member.data.role !== 'ADMIN') {
		return deny(403, 'Admin access required');
	}
	return member;
}

/**
 * Parses and validates a JSON body, or a 400.
 *
 * Handles the malformed-JSON case too: `await req.json()` throws on a truncated or empty body,
 * which previously escaped as an unhandled 500 rather than the 400 it is.
 */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<Guarded<T>> {
	let raw: unknown;
	try {
		raw = await req.json();
	} catch {
		return deny(400, 'Request body must be valid JSON');
	}

	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		const detail = parsed.error.issues
			.map(issue => (issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
			.join('; ');
		return deny(400, detail || 'Invalid request body');
	}
	return { ok: true, data: parsed.data };
}
