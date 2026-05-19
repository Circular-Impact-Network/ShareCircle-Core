import { NextRequest, NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

// POST /api/test/create-session
// Creates a NextAuth JWT for the given test user and returns it with the cookie name.
// Allows global-setup to bypass browser-UI login when running in production builds (next start).
export async function POST(req: NextRequest) {
	if (process.env.NODE_ENV === 'production' && !process.env.TEST_CLEANUP_SECRET) {
		return NextResponse.json({ error: 'Not found' }, { status: 404 });
	}

	const secret = req.headers.get('x-test-secret');
	if (!secret || secret !== process.env.TEST_CLEANUP_SECRET) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = (await req.json()) as { email?: string };
	const email = body.email?.toLowerCase();

	if (!email || !/^e2e\+.+@example\.com$/.test(email)) {
		return NextResponse.json({ error: 'Invalid test email' }, { status: 400 });
	}

	const user = await prisma.user.findUnique({
		where: { email },
		select: { id: true, email: true, name: true, image: true, emailVerified: true },
	});

	if (!user) {
		return NextResponse.json({ error: 'User not found' }, { status: 404 });
	}

	const nextAuthSecret = process.env.NEXTAUTH_SECRET;
	if (!nextAuthSecret) {
		return NextResponse.json({ error: 'NEXTAUTH_SECRET not configured' }, { status: 500 });
	}

	// next-auth v4: getToken calls decode() with no salt, so encode with no salt (salt="") to match.
	const token = await encode({
		token: {
			sub: user.id,
			id: user.id,
			email: user.email,
			name: user.name,
			image: user.image ?? null,
			emailVerified: user.emailVerified ?? null,
		},
		secret: nextAuthSecret,
		maxAge: 24 * 60 * 60,
	});

	const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false;
	const cookieName = useSecureCookies ? '__Secure-next-auth.session-token' : 'next-auth.session-token';

	return NextResponse.json({ token, cookieName });
}
