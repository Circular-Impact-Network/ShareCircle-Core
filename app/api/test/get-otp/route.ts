import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/test/get-otp?email=e2e+...@example.com
// Returns the most recent OTP for the given test email.
// Only available in non-production environments and requires TEST_CLEANUP_SECRET header.
export async function GET(req: NextRequest) {
	if (process.env.NODE_ENV === 'production') {
		return NextResponse.json({ error: 'Not found' }, { status: 404 });
	}

	const secret = req.headers.get('x-test-secret');
	if (!secret || secret !== process.env.TEST_CLEANUP_SECRET) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const email = req.nextUrl.searchParams.get('email')?.toLowerCase();
	if (!email || !/^e2e\+.+@example\.com$/.test(email)) {
		return NextResponse.json({ error: 'Invalid test email' }, { status: 400 });
	}

	const record = await prisma.testOtp.findFirst({
		where: { email },
		orderBy: { createdAt: 'desc' },
	});

	if (!record) {
		return NextResponse.json({ error: 'No OTP found for this email' }, { status: 404 });
	}

	return NextResponse.json({ otp: record.otp });
}
