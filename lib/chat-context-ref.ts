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
