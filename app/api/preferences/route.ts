import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { parseBody, requireUser } from '@/lib/api-guards';
import { DEFAULT_CURRENCY, isCurrencyCode } from '@/lib/currency';
import { DEFAULT_FONT_SIZE, DEFAULT_WEIGHT_UNIT, isFontSizeKey, isWeightUnit } from '@/lib/preferences';

/**
 * Display preferences: units, currency, font size, theme.
 *
 * These lived only in localStorage, which meant a user's own item weights appeared to change when
 * they signed in on a second device — it silently reverted them to kilograms and USD. Persisting
 * per account makes the choice follow the person rather than the browser.
 */

// Validated against the same predicates the client uses, so the two cannot disagree about what a
// legal value is. Every field is optional: the settings screen saves one control at a time.
const preferencesSchema = z
	.object({
		theme: z.enum(['light', 'dark']).optional(),
		fontSize: z.string().refine(isFontSizeKey, 'Unsupported font size').optional(),
		weightUnit: z.string().refine(isWeightUnit, 'Unsupported weight unit').optional(),
		currency: z.string().refine(isCurrencyCode, 'Unsupported currency').optional(),
	})
	.refine(value => Object.keys(value).length > 0, 'At least one preference must be provided');

const DEFAULTS = {
	theme: 'light',
	fontSize: DEFAULT_FONT_SIZE,
	weightUnit: DEFAULT_WEIGHT_UNIT,
	currency: DEFAULT_CURRENCY,
} as const;

export async function GET() {
	const guard = await requireUser();
	if (!guard.ok) {
		return guard.response;
	}

	try {
		const row = await prisma.userDisplayPreference.findUnique({
			where: { userId: guard.data.userId },
			select: { theme: true, fontSize: true, weightUnit: true, currency: true },
		});

		// No row is the normal state for every account that predates this table, not an error.
		// `stored` distinguishes "never saved" from "saved values that happen to be the defaults",
		// which is what lets the client migrate an existing browser's choice up exactly once
		// instead of overwriting a real server-side choice with a stale local one.
		return NextResponse.json({ ...(row ?? DEFAULTS), stored: Boolean(row) }, { status: 200 });
	} catch (error) {
		console.error('Failed to read display preferences:', error);
		return NextResponse.json({ error: 'Failed to read preferences' }, { status: 500 });
	}
}

export async function PATCH(req: Request) {
	const guard = await requireUser();
	if (!guard.ok) {
		return guard.response;
	}

	const body = await parseBody(req, preferencesSchema);
	if (!body.ok) {
		return body.response;
	}

	try {
		const updated = await prisma.userDisplayPreference.upsert({
			where: { userId: guard.data.userId },
			create: { userId: guard.data.userId, ...DEFAULTS, ...body.data },
			update: body.data,
			select: { theme: true, fontSize: true, weightUnit: true, currency: true },
		});

		return NextResponse.json(updated, { status: 200 });
	} catch (error) {
		console.error('Failed to save display preferences:', error);
		return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
	}
}
