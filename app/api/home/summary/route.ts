import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BorrowRequestStatus, ItemRequestStatus, NotificationStatus, NotificationType } from '@prisma/client';
import { getSignedUrls } from '@/lib/supabase';

// One round-trip union of the 7 RTK queries the dashboard mounts on first load.
// Drastically reduces first-paint latency vs. 7 sequential hydrate→fetch→DB hops.
export async function GET() {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}
		const userId = session.user.id;

		const [
			user,
			notifications,
			unreadCount,
			unreadMessages,
			circlesRaw,
			pendingBorrowRaw,
			openItemRequestsRaw,
			recentThreads,
		] = await Promise.all([
			prisma.user.findUnique({
				where: { id: userId },
				select: {
					id: true,
					name: true,
					email: true,
					image: true,
					created_at: true,
					phone_number: true,
					country_code: true,
				},
			}),
			prisma.notification.findMany({
				where: { userId },
				orderBy: { createdAt: 'desc' },
				take: 5,
			}),
			prisma.notification.count({ where: { userId, status: NotificationStatus.UNREAD } }),
			prisma.notification.count({
				where: { userId, status: NotificationStatus.UNREAD, type: NotificationType.NEW_MESSAGE },
			}),
			prisma.circle.findMany({
				where: { members: { some: { userId, leftAt: null } } },
				orderBy: { createdAt: 'desc' },
				take: 10,
				select: {
					id: true,
					name: true,
					description: true,
					avatarPath: true,
					avatarUrl: true,
					createdAt: true,
					_count: { select: { members: { where: { leftAt: null } } } },
				},
			}),
			prisma.borrowRequest.findMany({
				where: { ownerId: userId, status: BorrowRequestStatus.PENDING },
				orderBy: { createdAt: 'desc' },
				take: 10,
				include: {
					item: { select: { id: true, name: true, imagePath: true } },
					requester: { select: { id: true, name: true, image: true } },
				},
			}),
			prisma.itemRequest.findMany({
				where: {
					status: ItemRequestStatus.OPEN,
					OR: [
						{ requesterId: userId },
						{ circles: { some: { circle: { members: { some: { userId, leftAt: null } } } } } },
					],
				},
				orderBy: { createdAt: 'desc' },
				take: 10,
				include: {
					requester: { select: { id: true, name: true, image: true } },
				},
			}),
			// Recent conversations the user participates in. Limit 3 for the home preview card.
			prisma.conversation.findMany({
				where: { participants: { some: { userId, deletedAt: null } } },
				orderBy: { lastMessageAt: 'desc' },
				take: 3,
				include: {
					participants: {
						where: { userId: { not: userId } },
						take: 1,
						include: { user: { select: { id: true, name: true, image: true } } },
					},
				},
			}),
		]);

		// Batch-sign avatar paths in one Supabase call per bucket.
		const circleAvatarPaths = circlesRaw.map(c => c.avatarPath).filter(Boolean) as string[];
		const itemImagePaths = pendingBorrowRaw.map(b => b.item.imagePath).filter(Boolean);
		const [avatarUrlMap, itemUrlMap] = await Promise.all([
			circleAvatarPaths.length
				? getSignedUrls(circleAvatarPaths, 'avatars').catch(() => new Map())
				: new Map<string, string>(),
			itemImagePaths.length
				? getSignedUrls(itemImagePaths, 'items').catch(() => new Map())
				: new Map<string, string>(),
		]);

		const circles = circlesRaw.map(c => ({
			id: c.id,
			name: c.name,
			description: c.description,
			avatarUrl: c.avatarPath ? (avatarUrlMap.get(c.avatarPath) ?? c.avatarUrl) : c.avatarUrl,
			membersCount: c._count.members,
			createdAt: c.createdAt,
		}));

		const pendingBorrowRequests = pendingBorrowRaw.map(b => ({
			id: b.id,
			status: b.status,
			desiredFrom: b.desiredFrom,
			desiredTo: b.desiredTo,
			createdAt: b.createdAt,
			item: {
				id: b.item.id,
				name: b.item.name,
				imageUrl: itemUrlMap.get(b.item.imagePath) ?? '',
			},
			requester: b.requester,
		}));

		const openItemRequests = openItemRequestsRaw.map(r => ({
			id: r.id,
			title: r.title,
			description: r.description,
			status: r.status,
			createdAt: r.createdAt,
			requester: r.requester,
		}));

		// Translate snake_case → camelCase for the API contract (matches /api/user shape).
		const userPayload = user
			? {
					id: user.id,
					name: user.name,
					email: user.email,
					image: user.image,
					createdAt: user.created_at,
					phoneNumber: user.phone_number,
					countryCode: user.country_code,
				}
			: null;

		return NextResponse.json({
			user: userPayload,
			notifications: {
				items: notifications,
				unreadCount,
			},
			unreadMessages: { unreadCount: unreadMessages },
			pendingBorrowRequests,
			openItemRequests,
			circles,
			recentThreads: recentThreads.map(t => ({
				id: t.id,
				lastMessageAt: t.lastMessageAt,
				peer: t.participants[0]?.user ?? null,
			})),
		});
	} catch (error) {
		console.error('Home summary error:', error);
		return NextResponse.json({ error: 'Failed to fetch home summary' }, { status: 500 });
	}
}
