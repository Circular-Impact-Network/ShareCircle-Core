import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
	if (process.env.NODE_ENV === 'production') {
		return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
	}

	const secret = req.headers.get('x-test-cleanup-secret');
	if (!secret || secret !== process.env.TEST_CLEANUP_SECRET) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await req.json();
		const emails = Array.isArray(body?.emails) ? (body.emails as string[]) : [];

		if (emails.length === 0) {
			return NextResponse.json({ error: 'No emails provided' }, { status: 400 });
		}

		const result = await prisma.user.deleteMany({
			where: {
				email: { in: emails },
			},
		});

		return NextResponse.json({ deleted: result.count }, { status: 200 });
	} catch (error) {
		console.error('Test cleanup error:', error);
		return NextResponse.json({ error: 'Failed to cleanup test data' }, { status: 500 });
	}
}
