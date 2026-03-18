import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { NotificationType } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import {
	NOTIFICATION_CATALOG,
	NOTIFICATION_TYPE_TO_CATEGORY,
	isNotificationCategoryId,
	isNotificationType,
} from '@/lib/notification-catalog';
import {
	buildEffectiveByType,
	ensureNotificationPreferences,
	serializePreferenceRow,
} from '@/lib/notification-preferences';
import { isPushConfigured } from '@/lib/push';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

const ALL_NOTIFICATION_TYPES = Object.keys(NOTIFICATION_TYPE_TO_CATEGORY) as NotificationType[];

type OverridePayload = { inApp?: boolean; push?: boolean };

function parseOverridesRecord(
	raw: unknown,
	validator: (key: string) => boolean,
): Record<string, OverridePayload> | { error: string } {
	if (raw === undefined) {
		return {};
	}
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return { error: 'Overrides must be an object' };
	}
	const out: Record<string, OverridePayload> = {};
	for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
		if (!validator(key)) {
			return { error: `Unknown key: ${key}` };
		}
		if (value === null || value === undefined) {
			continue;
		}
		if (typeof value !== 'object' || Array.isArray(value)) {
			return { error: `Invalid override for ${key}` };
		}
		const o = value as Record<string, unknown>;
		const entry: OverridePayload = {};
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

export async function GET() {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const row = await ensureNotificationPreferences(session.user.id);

		return NextResponse.json(
			{
				catalog: NOTIFICATION_CATALOG,
				stored: serializePreferenceRow(row),
				effectiveByType: buildEffectiveByType(row, ALL_NOTIFICATION_TYPES),
				pushConfigured: isPushConfigured(),
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('GET notification-preferences:', error);
		if (error instanceof Prisma.PrismaClientKnownRequestError) {
			// Table/column missing — migrations not applied (common in new deploys).
			if (error.code === 'P2021' || error.code === 'P2022') {
				return NextResponse.json(
					{
						error: 'Notification settings storage is not ready.',
						hint: 'Apply pending Prisma migrations on this database (e.g. `npx prisma migrate deploy`), then reload.',
					},
					{ status: 503 },
				);
			}
		}
		return NextResponse.json({ error: 'Failed to load preferences' }, { status: 500 });
	}
}

export async function PATCH(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = (await req.json()) as {
			globalInApp?: unknown;
			globalPush?: unknown;
			categoryOverrides?: unknown;
			typeOverrides?: unknown;
		};

		const data: Prisma.UserNotificationPreferenceUpdateInput = {};

		if (body.globalInApp !== undefined) {
			if (typeof body.globalInApp !== 'boolean') {
				return NextResponse.json({ error: 'globalInApp must be a boolean' }, { status: 400 });
			}
			data.globalInApp = body.globalInApp;
		}

		if (body.globalPush !== undefined) {
			if (typeof body.globalPush !== 'boolean') {
				return NextResponse.json({ error: 'globalPush must be a boolean' }, { status: 400 });
			}
			data.globalPush = body.globalPush;
		}

		if (body.categoryOverrides !== undefined) {
			const parsed = parseOverridesRecord(body.categoryOverrides, isNotificationCategoryId);
			if ('error' in parsed) {
				return NextResponse.json({ error: parsed.error }, { status: 400 });
			}
			data.categoryOverrides = parsed as Prisma.InputJsonValue;
		}

		if (body.typeOverrides !== undefined) {
			const parsed = parseOverridesRecord(body.typeOverrides, isNotificationType);
			if ('error' in parsed) {
				return NextResponse.json({ error: parsed.error }, { status: 400 });
			}
			data.typeOverrides = parsed as Prisma.InputJsonValue;
		}

		if (Object.keys(data).length === 0) {
			return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
		}

		await ensureNotificationPreferences(session.user.id);

		const row = await prisma.userNotificationPreference.update({
			where: { userId: session.user.id },
			data,
		});

		return NextResponse.json(
			{
				stored: serializePreferenceRow(row),
				effectiveByType: buildEffectiveByType(row, ALL_NOTIFICATION_TYPES),
				pushConfigured: isPushConfigured(),
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('PATCH notification-preferences:', error);
		if (error instanceof Prisma.PrismaClientKnownRequestError) {
			if (error.code === 'P2021' || error.code === 'P2022') {
				return NextResponse.json(
					{
						error: 'Notification settings storage is not ready.',
						hint: 'Apply pending Prisma migrations on this database (e.g. `npx prisma migrate deploy`), then try again.',
					},
					{ status: 503 },
				);
			}
		}
		return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
	}
}
