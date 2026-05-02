import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIdentifier, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';

const VALID_CATEGORIES = ["Bug", "Feature idea", "General", "What's working"] as const;

export async function POST(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const identifier = getClientIdentifier(req, session.user.id);
		const rateLimitResult = checkRateLimit(identifier, 'feedback', RATE_LIMITS.ai);
		if (!rateLimitResult.success) {
			return rateLimitResponse(rateLimitResult);
		}

		const body = await req.json();
		const { rating, category, message, currentPage, deviceType, appVersion, followUpConsent, taskContext, attachmentPath } =
			body;

		if (typeof rating !== 'number' || rating < 1 || rating > 5) {
			return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
		}
		if (!category || !VALID_CATEGORIES.includes(category)) {
			return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
		}

		await prisma.feedback.create({
			data: {
				userId: session.user.id,
				rating,
				category,
				message: typeof message === 'string' ? message.trim().slice(0, 2000) || null : null,
				currentPage: typeof currentPage === 'string' ? currentPage.slice(0, 200) : null,
				deviceType: typeof deviceType === 'string' ? deviceType.slice(0, 50) : null,
				appVersion: typeof appVersion === 'string' ? appVersion.slice(0, 20) : null,
				followUpConsent: typeof followUpConsent === 'boolean' ? followUpConsent : null,
				taskContext: typeof taskContext === 'string' ? taskContext.slice(0, 200) : null,
				attachmentPath: typeof attachmentPath === 'string' ? attachmentPath.slice(0, 500) : null,
			},
		});

		return NextResponse.json({ success: true }, { status: 201 });
	} catch (error) {
		console.error('Feedback submission error:', error);
		return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
	}
}
