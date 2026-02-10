import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from '@/lib/rate-limit';
import { generateResetToken, sendPasswordResetEmail } from '@/lib/email';
import { normalizeEmail } from '@/lib/otp';

export async function POST(req: NextRequest) {
	try {
		// Rate limiting - stricter for password reset to prevent enumeration attacks
		const identifier = getClientIdentifier(req);
		const rateLimitResult = checkRateLimit(identifier, 'auth-forgot-password', {
			maxRequests: 5,
			windowSeconds: 3600, // 1 hour window
		});
		if (!rateLimitResult.success) {
			return rateLimitResponse(rateLimitResult);
		}

		const body = await req.json();
		const { email } = body;
		const normalizedEmail = email ? normalizeEmail(email) : '';

		if (!normalizedEmail) {
			return NextResponse.json({ error: 'Email is required' }, { status: 400 });
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(normalizedEmail)) {
			return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
		}

		// Always return success message to prevent email enumeration
		const successMessage = 'If an account exists with this email, you will receive a password reset link.';

		if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
			console.warn('GMAIL credentials not configured - password reset email not sent');
			return NextResponse.json(
				{ error: 'Email service is not configured. Please try again later.' },
				{ status: 500 },
			);
		}

		// Find user
		const user = await prisma.user.findUnique({
			where: { email: normalizedEmail },
		});

		// If user doesn't exist, silently succeed
		if (!user) {
			return NextResponse.json({ message: successMessage }, { status: 200 });
		}

		// Generate reset token
		const resetToken = generateResetToken();
		const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

		// Delete any existing reset tokens for this email
		await prisma.verificationToken.deleteMany({
			where: {
				identifier: `reset:${normalizedEmail}`,
			},
		});

		// Store reset token
		await prisma.verificationToken.create({
			data: {
				identifier: `reset:${normalizedEmail}`,
				token: resetToken,
				expires: tokenExpiry,
			},
		});

		// Send password reset email
		try {
			await sendPasswordResetEmail(normalizedEmail, resetToken);
		} catch (emailError) {
			console.error('Failed to send password reset email:', emailError);
			return NextResponse.json(
				{ error: 'Failed to send password reset email. Please try again.' },
				{ status: 500 },
			);
		}

		return NextResponse.json({ message: successMessage }, { status: 200 });
	} catch (error) {
		console.error('Forgot password error:', error);
		return NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 });
	}
}
