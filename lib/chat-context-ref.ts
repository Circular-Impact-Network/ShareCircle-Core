import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// Canonical type for an item / item-request reference attached to a chat message.
// Lives here (not in components/chat/types.ts) so server code can import it
// without pulling client-only types.
export type ContextRef = {
	type: 'item' | 'item-request';
	id: string;
	title: string;
	imageUrl?: string;
};

// Zod schema used by the messages POST route to validate the inbound
// client payload. The server re-derives the canonical shape from the DB
// via resolveContextRef — clients can suggest the reference but cannot
// dictate the persisted title / imageUrl.
export const contextRefSchema = z.object({
	type: z.enum(['item', 'item-request']),
	id: z.string().min(1).max(64),
	title: z.string().min(1).max(200),
	imageUrl: z.string().max(2048).optional(),
});

// ---------- URL <-> ContextRef helpers (used by client navigation) ----------

// Builds the `?context=` query param used to pre-attach an item or item-request
// reference to a new chat thread. Pair with parseContextRefParam on the server
// to decode.
export function buildContextRefParam(ref: ContextRef): string {
	return `context=${encodeURIComponent(JSON.stringify(ref))}`;
}

// Decodes a `?context=` query param value back into a ContextRef. Returns null
// on any parse / validation failure so the caller can fall through gracefully.
export function parseContextRefParam(raw: string | undefined): ContextRef | null {
	if (!raw) return null;
	try {
		const parsed = contextRefSchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

// ---------- Server-side resolution ----------

// Returns the canonical ContextRef to persist on a message, or null if the
// reference does not exist or the sender cannot see it.
//
// Authorization rule: the sender must share at least one circle with the
// referenced item / item-request. This prevents leaking the title of items
// the sender cannot themselves see.
export async function resolveContextRef(userId: string, ref: ContextRef | null | undefined): Promise<ContextRef | null> {
	if (!ref) return null;

	const memberships = await prisma.circleMember.findMany({
		where: { userId, leftAt: null },
		select: { circleId: true },
	});
	const userCircleIds = memberships.map(m => m.circleId);
	if (userCircleIds.length === 0) return null;

	if (ref.type === 'item') {
		const item = await prisma.item.findFirst({
			where: {
				id: ref.id,
				OR: [{ ownerId: userId }, { circles: { some: { circleId: { in: userCircleIds } } } }],
			},
			select: { id: true, name: true },
		});
		if (!item) return null;
		return { type: 'item', id: item.id, title: item.name };
	}

	const itemRequest = await prisma.itemRequest.findFirst({
		where: {
			id: ref.id,
			OR: [{ requesterId: userId }, { circles: { some: { circleId: { in: userCircleIds } } } }],
		},
		select: { id: true, title: true },
	});
	if (!itemRequest) return null;
	return { type: 'item-request', id: itemRequest.id, title: itemRequest.title };
}
