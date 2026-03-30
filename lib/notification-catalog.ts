import { NotificationType } from '@prisma/client';

export const NOTIFICATION_CATEGORY_IDS = [
	'MESSAGES',
	'ITEM_REQUESTS',
	'BORROW_REQUESTS',
	'QUEUE',
	'RETURNS',
] as const;

export type NotificationCategoryId = (typeof NOTIFICATION_CATEGORY_IDS)[number];

export type NotificationChannelOverride = {
	inApp?: boolean;
	push?: boolean;
};

export type NotificationTypeDefinition = {
	type: NotificationType;
	title: string;
	description: string;
};

export type NotificationCategoryDefinition = {
	id: NotificationCategoryId;
	title: string;
	description: string;
	types: NotificationTypeDefinition[];
};

export const NOTIFICATION_TYPE_TO_CATEGORY: Record<NotificationType, NotificationCategoryId> = {
	NEW_MESSAGE: 'MESSAGES',
	ITEM_REQUEST_CREATED: 'ITEM_REQUESTS',
	ITEM_REQUEST_FULFILLED: 'ITEM_REQUESTS',
	BORROW_REQUEST_RECEIVED: 'BORROW_REQUESTS',
	BORROW_REQUEST_APPROVED: 'BORROW_REQUESTS',
	BORROW_REQUEST_DECLINED: 'BORROW_REQUESTS',
	QUEUE_POSITION_UPDATED: 'QUEUE',
	QUEUE_ITEM_READY: 'QUEUE',
	ITEM_HANDOFF_CONFIRMED: 'RETURNS',
	ITEM_RECEIVED_CONFIRMED: 'RETURNS',
	RETURN_REQUESTED: 'RETURNS',
	RETURN_CONFIRMED: 'RETURNS',
};

export const NOTIFICATION_CATALOG: NotificationCategoryDefinition[] = [
	{
		id: 'MESSAGES',
		title: 'Messages',
		description: 'When someone sends you a direct message.',
		types: [
			{
				type: 'NEW_MESSAGE',
				title: 'New messages',
				description: 'Alerts when you receive a chat message.',
			},
		],
	},
	{
		id: 'ITEM_REQUESTS',
		title: 'Item requests',
		description: 'Activity on requests for items in your circles.',
		types: [
			{
				type: 'ITEM_REQUEST_CREATED',
				title: 'New item request',
				description: 'Someone posted a new request in a circle you belong to.',
			},
			{
				type: 'ITEM_REQUEST_FULFILLED',
				title: 'Request fulfilled',
				description: 'An item request you care about was marked fulfilled.',
			},
		],
	},
	{
		id: 'BORROW_REQUESTS',
		title: 'Borrow requests',
		description: 'Approvals, declines, and incoming borrow requests.',
		types: [
			{
				type: 'BORROW_REQUEST_RECEIVED',
				title: 'Someone wants to borrow your item',
				description: 'A member requested to borrow something you listed.',
			},
			{
				type: 'BORROW_REQUEST_APPROVED',
				title: 'Borrow request approved',
				description: 'Your borrow request was approved.',
			},
			{
				type: 'BORROW_REQUEST_DECLINED',
				title: 'Borrow request declined',
				description: 'Your borrow request was declined.',
			},
		],
	},
	{
		id: 'QUEUE',
		title: 'Waitlist',
		description: 'Queue position and availability updates.',
		types: [
			{
				type: 'QUEUE_POSITION_UPDATED',
				title: 'Queue position changed',
				description: 'Your place in a borrow queue moved.',
			},
			{
				type: 'QUEUE_ITEM_READY',
				title: 'Item ready for you',
				description: 'An item you were waiting for is available.',
			},
		],
	},
	{
		id: 'RETURNS',
		title: 'Handoff & Returns',
		description: 'Item handoff, receipt, and return confirmations.',
		types: [
			{
				type: 'ITEM_HANDOFF_CONFIRMED',
				title: 'Item handed off',
				description: 'The lender confirmed handing off the item.',
			},
			{
				type: 'ITEM_RECEIVED_CONFIRMED',
				title: 'Item received',
				description: 'The borrower confirmed receiving the item.',
			},
			{
				type: 'RETURN_REQUESTED',
				title: 'Return requested',
				description: 'The borrower marked an item as returned; you may need to confirm.',
			},
			{
				type: 'RETURN_CONFIRMED',
				title: 'Return confirmed',
				description: 'A return was confirmed for an item you borrowed or lent.',
			},
		],
	},
];

const ALL_TYPES = Object.keys(NOTIFICATION_TYPE_TO_CATEGORY) as NotificationType[];

export function isNotificationCategoryId(value: string): value is NotificationCategoryId {
	return (NOTIFICATION_CATEGORY_IDS as readonly string[]).includes(value);
}

export function isNotificationType(value: string): value is NotificationType {
	return (ALL_TYPES as readonly string[]).includes(value);
}

export function getCategoryIdForNotificationType(type: NotificationType): NotificationCategoryId {
	return NOTIFICATION_TYPE_TO_CATEGORY[type];
}
