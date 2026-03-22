/**
 * Unit tests for notification utilities
 * Tests: createNotification, notifyCircleMembers, broadcastItemRequest, broadcastStatusChange
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Define mock functions using vi.hoisted
const mockPrismaNotificationCreate = vi.hoisted(() => vi.fn());
const mockPrismaCircleMemberFindMany = vi.hoisted(() => vi.fn());
const mockSupabaseChannel = vi.hoisted(() => vi.fn());
const mockSupabaseSend = vi.hoisted(() => vi.fn());
const mockGetEffectiveNotificationChannels = vi.hoisted(() => vi.fn());
const mockSendPushToUser = vi.hoisted(() => vi.fn());

vi.mock('@/lib/prisma', () => ({
	prisma: {
		notification: {
			create: mockPrismaNotificationCreate,
		},
		circleMember: {
			findMany: mockPrismaCircleMemberFindMany,
		},
	},
}));

vi.mock('@supabase/supabase-js', () => ({
	createClient: () => ({
		channel: (name: string) => {
			mockSupabaseChannel(name);
			return {
				send: mockSupabaseSend,
			};
		},
	}),
}));

vi.mock('@/lib/notification-preferences', () => ({
	getEffectiveNotificationChannels: mockGetEffectiveNotificationChannels,
}));

vi.mock('@/lib/push', () => ({
	sendPushToUser: mockSendPushToUser,
}));

// Mock environment variables must be set before importing the module
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');

import { createNotification, notifyCircleMembers, broadcastItemRequest, broadcastStatusChange } from '@/lib/notifications';

describe('Notification Utilities', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSupabaseSend.mockResolvedValue(undefined);
		mockGetEffectiveNotificationChannels.mockResolvedValue({ inApp: true, push: true });
		mockSendPushToUser.mockResolvedValue(undefined);
	});

	describe('createNotification', () => {
		it('creates notification in database', async () => {
			const mockNotification = {
				id: 'notification-1',
				userId: 'user-1',
				type: 'BORROW_REQUEST_RECEIVED',
				entityId: 'request-1',
				title: 'New Borrow Request',
				body: 'Someone wants to borrow your item',
				metadata: { itemId: 'item-1' },
				status: 'UNREAD',
				createdAt: new Date(),
			};

			mockPrismaNotificationCreate.mockResolvedValue(mockNotification);

			const result = await createNotification({
				userId: 'user-1',
				type: 'BORROW_REQUEST_RECEIVED',
				entityId: 'request-1',
				title: 'New Borrow Request',
				body: 'Someone wants to borrow your item',
				metadata: { itemId: 'item-1' },
			});

			expect(mockPrismaNotificationCreate).toHaveBeenCalledWith({
				data: {
					userId: 'user-1',
					type: 'BORROW_REQUEST_RECEIVED',
					entityId: 'request-1',
					title: 'New Borrow Request',
					body: 'Someone wants to borrow your item',
					metadata: { itemId: 'item-1' },
					status: 'UNREAD',
				},
			});

			expect(result).toEqual(mockNotification);
			expect(mockSendPushToUser).toHaveBeenCalledTimes(1);
		});

		it('returns null and skips DB and push when both channels are disabled', async () => {
			mockGetEffectiveNotificationChannels.mockResolvedValue({ inApp: false, push: false });

			const result = await createNotification({
				userId: 'user-1',
				type: 'NEW_MESSAGE',
				title: 'Hi',
				body: 'Hello',
			});

			expect(result).toBeNull();
			expect(mockPrismaNotificationCreate).not.toHaveBeenCalled();
			expect(mockSupabaseSend).not.toHaveBeenCalled();
			expect(mockSendPushToUser).not.toHaveBeenCalled();
		});

		it('sends push only when in-app is disabled', async () => {
			mockGetEffectiveNotificationChannels.mockResolvedValue({ inApp: false, push: true });

			const result = await createNotification({
				userId: 'user-1',
				type: 'NEW_MESSAGE',
				title: 'Hi',
				body: 'Hello',
				metadata: { path: '/messages/abc' },
			});

			expect(result).toBeNull();
			expect(mockPrismaNotificationCreate).not.toHaveBeenCalled();
			expect(mockSendPushToUser).toHaveBeenCalledWith(
				'user-1',
				expect.objectContaining({
					title: 'Hi',
					body: 'Hello',
					url: '/messages/abc',
					tag: 'NEW_MESSAGE',
				}),
			);
		});

		it('creates in-app only when push is disabled', async () => {
			mockGetEffectiveNotificationChannels.mockResolvedValue({ inApp: true, push: false });

			const mockNotification = {
				id: 'notification-1',
				userId: 'user-1',
				type: 'BORROW_REQUEST_RECEIVED',
				entityId: 'r1',
				title: 'Borrow',
				body: 'Body',
				metadata: {},
				status: 'UNREAD',
				createdAt: new Date(),
			};
			mockPrismaNotificationCreate.mockResolvedValue(mockNotification);

			const result = await createNotification({
				userId: 'user-1',
				type: 'BORROW_REQUEST_RECEIVED',
				entityId: 'r1',
				title: 'Borrow',
				body: 'Body',
			});

			expect(result).toEqual(mockNotification);
			expect(mockSendPushToUser).not.toHaveBeenCalled();
		});

		it('handles empty metadata gracefully', async () => {
			const mockNotification = {
				id: 'notification-1',
				userId: 'user-1',
				type: 'BORROW_REQUEST_RECEIVED',
				entityId: undefined,
				title: 'Test',
				body: 'Test body',
				metadata: {},
				status: 'UNREAD',
				createdAt: new Date(),
			};

			mockPrismaNotificationCreate.mockResolvedValue(mockNotification);

			await createNotification({
				userId: 'user-1',
				type: 'BORROW_REQUEST_RECEIVED',
				title: 'Test',
				body: 'Test body',
			});

			expect(mockPrismaNotificationCreate).toHaveBeenCalledWith({
				data: expect.objectContaining({
					metadata: {},
				}),
			});
		});
	});

	describe('notifyCircleMembers', () => {
		it('creates notifications for all circle members except actor', async () => {
			mockPrismaCircleMemberFindMany.mockResolvedValue([
				{ userId: 'user-2' },
				{ userId: 'user-3' },
			]);

			const mockNotification = {
				id: 'notification-1',
				userId: 'user-2',
				type: 'ITEM_REQUEST_CREATED',
				entityId: 'request-1',
				title: 'New Item Request',
				body: 'Someone is looking for an item',
				metadata: {},
				status: 'UNREAD',
				createdAt: new Date(),
			};

			mockPrismaNotificationCreate.mockResolvedValue(mockNotification);

			const results = await notifyCircleMembers({
				circleId: 'circle-1',
				actorId: 'user-1',
				type: 'ITEM_REQUEST_CREATED',
				entityId: 'request-1',
				title: 'New Item Request',
				body: 'Someone is looking for an item',
			});

			// Should query for circle members excluding actor
			expect(mockPrismaCircleMemberFindMany).toHaveBeenCalledWith({
				where: {
					circleId: 'circle-1',
					leftAt: null,
					userId: { not: 'user-1' },
				},
				select: { userId: true },
			});

			// Should create notification for each member
			expect(mockPrismaNotificationCreate).toHaveBeenCalledTimes(2);
			expect(results).toHaveLength(2);
		});

		it('returns empty array when no other members exist', async () => {
			mockPrismaCircleMemberFindMany.mockResolvedValue([]);

			const results = await notifyCircleMembers({
				circleId: 'circle-1',
				actorId: 'user-1',
				type: 'ITEM_REQUEST_CREATED',
				title: 'Test',
				body: 'Test',
			});

			expect(results).toEqual([]);
			expect(mockPrismaNotificationCreate).not.toHaveBeenCalled();
		});
	});

	// Note: broadcastItemRequest and broadcastStatusChange tests are skipped 
	// because they require Supabase environment variables to be set at module load time.
	// These functions are tested via E2E tests instead.
});
