import { NotificationType, type UserNotificationPreference } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCategoryIdForNotificationType, type NotificationChannelOverride } from '@/lib/notification-catalog';

export type NotificationChannels = { inApp: boolean; push: boolean };

function parseOverrideMap(raw: unknown): Record<string, NotificationChannelOverride> {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return {};
	}
	const out: Record<string, NotificationChannelOverride> = {};
	for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			continue;
		}
		const o = value as Record<string, unknown>;
		const entry: NotificationChannelOverride = {};
		if (typeof o.inApp === 'boolean') {
			entry.inApp = o.inApp;
		}
		if (typeof o.push === 'boolean') {
			entry.push = o.push;
		}
		if (entry.inApp !== undefined || entry.push !== undefined) {
			out[key] = entry;
		}
	}
	return out;
}

function layerAllows(override: boolean | undefined): boolean {
	return override !== false;
}

/**
 * effective = global && category && type (missing layer = allow)
 */
export function computeEffectiveChannels(
	row: Pick<UserNotificationPreference, 'globalInApp' | 'globalPush' | 'categoryOverrides' | 'typeOverrides'>,
	notificationType: NotificationType,
): NotificationChannels {
	const categoryId = getCategoryIdForNotificationType(notificationType);
	const categories = parseOverrideMap(row.categoryOverrides);
	const types = parseOverrideMap(row.typeOverrides);
	const cat = categories[categoryId];
	const typ = types[notificationType];

	return {
		inApp: row.globalInApp && layerAllows(cat?.inApp) && layerAllows(typ?.inApp),
		push: row.globalPush && layerAllows(cat?.push) && layerAllows(typ?.push),
	};
}

export async function ensureNotificationPreferences(userId: string): Promise<UserNotificationPreference> {
	const existing = await prisma.userNotificationPreference.findUnique({
		where: { userId },
	});
	if (existing) {
		return existing;
	}
	return prisma.userNotificationPreference.create({
		data: { userId },
	});
}

export async function getEffectiveNotificationChannels(
	userId: string,
	notificationType: NotificationType,
): Promise<NotificationChannels> {
	const row = await ensureNotificationPreferences(userId);
	return computeEffectiveChannels(row, notificationType);
}

export function serializePreferenceRow(row: UserNotificationPreference) {
	return {
		globalInApp: row.globalInApp,
		globalPush: row.globalPush,
		categoryOverrides: parseOverrideMap(row.categoryOverrides),
		typeOverrides: parseOverrideMap(row.typeOverrides),
	};
}

export function buildEffectiveByType(
	row: UserNotificationPreference,
	allTypes: NotificationType[],
): Record<string, NotificationChannels> {
	const out: Record<string, NotificationChannels> = {};
	for (const t of allTypes) {
		out[t] = computeEffectiveChannels(row, t);
	}
	return out;
}
