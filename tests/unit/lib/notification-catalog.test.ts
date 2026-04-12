import { describe, it, expect } from 'vitest';
import {
	NOTIFICATION_CATALOG,
	NOTIFICATION_CATEGORY_IDS,
	NOTIFICATION_TYPE_TO_CATEGORY,
	isNotificationCategoryId,
	isNotificationType,
	getCategoryIdForNotificationType,
	type NotificationCategoryId,
} from '@/lib/notification-catalog';

/* All values from the Prisma NotificationType enum */
const ALL_NOTIFICATION_TYPES = [
	'NEW_MESSAGE',
	'ITEM_REQUEST_CREATED',
	'ITEM_REQUEST_FULFILLED',
	'BORROW_REQUEST_RECEIVED',
	'BORROW_REQUEST_APPROVED',
	'BORROW_REQUEST_DECLINED',
	'QUEUE_POSITION_UPDATED',
	'QUEUE_ITEM_READY',
	'ITEM_HANDOFF_CONFIRMED',
	'ITEM_RECEIVED_CONFIRMED',
	'RETURN_REQUESTED',
	'RETURN_CONFIRMED',
] as const;

describe('notification-catalog', () => {
	describe('NOTIFICATION_TYPE_TO_CATEGORY', () => {
		it('maps every NotificationType to a category', () => {
			for (const type of ALL_NOTIFICATION_TYPES) {
				expect(NOTIFICATION_TYPE_TO_CATEGORY[type]).toBeDefined();
				expect(NOTIFICATION_CATEGORY_IDS).toContain(NOTIFICATION_TYPE_TO_CATEGORY[type]);
			}
		});

		it('does not contain extra keys beyond the known types', () => {
			const mappedKeys = Object.keys(NOTIFICATION_TYPE_TO_CATEGORY);
			expect(mappedKeys).toHaveLength(ALL_NOTIFICATION_TYPES.length);
			for (const key of mappedKeys) {
				expect(ALL_NOTIFICATION_TYPES).toContain(key);
			}
		});
	});

	describe('NOTIFICATION_CATALOG', () => {
		it('has an entry for every category id', () => {
			const catalogIds = NOTIFICATION_CATALOG.map((c) => c.id);
			for (const id of NOTIFICATION_CATEGORY_IDS) {
				expect(catalogIds).toContain(id);
			}
		});

		it('includes every notification type exactly once across all categories', () => {
			const allTypesInCatalog: string[] = [];
			for (const category of NOTIFICATION_CATALOG) {
				for (const t of category.types) {
					allTypesInCatalog.push(t.type);
				}
			}

			expect(allTypesInCatalog).toHaveLength(ALL_NOTIFICATION_TYPES.length);
			for (const type of ALL_NOTIFICATION_TYPES) {
				expect(allTypesInCatalog).toContain(type);
			}
		});

		it('has non-empty title and description for every category', () => {
			for (const category of NOTIFICATION_CATALOG) {
				expect(category.title.length).toBeGreaterThan(0);
				expect(category.description.length).toBeGreaterThan(0);
			}
		});

		it('has non-empty title and description for every type definition', () => {
			for (const category of NOTIFICATION_CATALOG) {
				for (const t of category.types) {
					expect(t.title.length).toBeGreaterThan(0);
					expect(t.description.length).toBeGreaterThan(0);
				}
			}
		});

		it('groups types under the correct category', () => {
			for (const category of NOTIFICATION_CATALOG) {
				for (const t of category.types) {
					const expectedCategory = NOTIFICATION_TYPE_TO_CATEGORY[t.type];
					expect(expectedCategory).toBe(category.id);
				}
			}
		});
	});

	describe('isNotificationCategoryId', () => {
		it('returns true for all valid category ids', () => {
			for (const id of NOTIFICATION_CATEGORY_IDS) {
				expect(isNotificationCategoryId(id)).toBe(true);
			}
		});

		it('returns false for invalid category ids', () => {
			expect(isNotificationCategoryId('INVALID')).toBe(false);
			expect(isNotificationCategoryId('')).toBe(false);
			expect(isNotificationCategoryId('messages')).toBe(false);
		});

		it('is case-sensitive', () => {
			expect(isNotificationCategoryId('messages')).toBe(false);
			expect(isNotificationCategoryId('Messages')).toBe(false);
			expect(isNotificationCategoryId('MESSAGES')).toBe(true);
		});
	});

	describe('isNotificationType', () => {
		it('returns true for all valid notification types', () => {
			for (const type of ALL_NOTIFICATION_TYPES) {
				expect(isNotificationType(type)).toBe(true);
			}
		});

		it('returns false for invalid notification types', () => {
			expect(isNotificationType('INVALID_TYPE')).toBe(false);
			expect(isNotificationType('')).toBe(false);
			expect(isNotificationType('new_message')).toBe(false);
		});

		it('is case-sensitive', () => {
			expect(isNotificationType('new_message')).toBe(false);
			expect(isNotificationType('New_Message')).toBe(false);
			expect(isNotificationType('NEW_MESSAGE')).toBe(true);
		});
	});

	describe('getCategoryIdForNotificationType', () => {
		it('maps message types to MESSAGES category', () => {
			expect(getCategoryIdForNotificationType('NEW_MESSAGE')).toBe('MESSAGES');
		});

		it('maps item request types to ITEM_REQUESTS category', () => {
			expect(getCategoryIdForNotificationType('ITEM_REQUEST_CREATED')).toBe('ITEM_REQUESTS');
			expect(getCategoryIdForNotificationType('ITEM_REQUEST_FULFILLED')).toBe('ITEM_REQUESTS');
		});

		it('maps borrow request types to BORROW_REQUESTS category', () => {
			expect(getCategoryIdForNotificationType('BORROW_REQUEST_RECEIVED')).toBe('BORROW_REQUESTS');
			expect(getCategoryIdForNotificationType('BORROW_REQUEST_APPROVED')).toBe('BORROW_REQUESTS');
			expect(getCategoryIdForNotificationType('BORROW_REQUEST_DECLINED')).toBe('BORROW_REQUESTS');
		});

		it('maps queue types to QUEUE category', () => {
			expect(getCategoryIdForNotificationType('QUEUE_POSITION_UPDATED')).toBe('QUEUE');
			expect(getCategoryIdForNotificationType('QUEUE_ITEM_READY')).toBe('QUEUE');
		});

		it('maps return/handoff types to RETURNS category', () => {
			expect(getCategoryIdForNotificationType('ITEM_HANDOFF_CONFIRMED')).toBe('RETURNS');
			expect(getCategoryIdForNotificationType('ITEM_RECEIVED_CONFIRMED')).toBe('RETURNS');
			expect(getCategoryIdForNotificationType('RETURN_REQUESTED')).toBe('RETURNS');
			expect(getCategoryIdForNotificationType('RETURN_CONFIRMED')).toBe('RETURNS');
		});

		it('returns correct category for every type in the mapping', () => {
			for (const [type, category] of Object.entries(NOTIFICATION_TYPE_TO_CATEGORY)) {
				const result = getCategoryIdForNotificationType(type as (typeof ALL_NOTIFICATION_TYPES)[number]);
				expect(result).toBe(category);
			}
		});
	});

	describe('NOTIFICATION_CATEGORY_IDS', () => {
		it('contains exactly the expected categories', () => {
			expect([...NOTIFICATION_CATEGORY_IDS]).toEqual([
				'MESSAGES',
				'ITEM_REQUESTS',
				'BORROW_REQUESTS',
				'QUEUE',
				'RETURNS',
			]);
		});

		it('has no duplicates', () => {
			const unique = new Set(NOTIFICATION_CATEGORY_IDS);
			expect(unique.size).toBe(NOTIFICATION_CATEGORY_IDS.length);
		});
	});
});
