import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIdentifier, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { generateResetToken } from '@/lib/email';
import { getOtpIdentifier, hashOtp, normalizeEmail, OtpPurpose, timingSafeEqualHex } from '@/lib/otp';

export async function POST(req: NextRequest) {
	try {
		// Rate limiting for auth endpoints
		const identifier = getClientIdentifier(req);
		const rateLimitResult = checkRateLimit(identifier, 'auth-verify-otp', RATE_LIMITS.auth);
		if (!rateLimitResult.success) {
			return rateLimitResponse(rateLimitResult);
		}

		const body = await req.json();
		const { email, code, purpose } = body as { email?: string; code?: string; purpose?: OtpPurpose };

		if (!email || !code) {
			return NextResponse.json({ error: 'Email and verification code are required' }, { status: 400 });
		}

		const otpPurpose: OtpPurpose = purpose === 'password_reset' ? 'password_reset' : 'email_verification';
		const normalizedEmail = normalizeEmail(email);
		const otpIdentifier = getOtpIdentifier(normalizedEmail, otpPurpose);

		// Find the verification token
		const verificationToken = await prisma.verificationToken.findFirst({
			where: {
				identifier: otpIdentifier,
			},
		});

		if (!verificationToken) {
			return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
		}

		const expected = hashOtp(code, normalizedEmail, otpPurpose);
		const matches =
			verificationToken.token.length <= 8
				? verificationToken.token === code
				: timingSafeEqualHex(verificationToken.token, expected);
		if (!matches) {
			return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
		}

		// Check if token has expired
		if (new Date() > verificationToken.expires) {
			// Delete expired token
			await prisma.verificationToken.delete({
				where: {
					identifier_token: {
						identifier: otpIdentifier,
						token: verificationToken.token,
					},
				},
			});

			return NextResponse.json(
				{ error: 'Verification code has expired. Please request a new one.' },
				{ status: 400 },
			);
		}

		// Find the user and update emailVerified
		const user = await prisma.user.findUnique({
			where: { email: normalizedEmail },
		});

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		if (otpPurpose === 'email_verification') {
			await prisma.user.update({
				where: { id: user.id },
				data: { emailVerified: new Date() },
			});
		}

		// Delete the used verification token
		await prisma.verificationToken.delete({
			where: {
				identifier_token: {
					identifier: otpIdentifier,
					token: verificationToken.token,
				},
			},
		});

		if (otpPurpose === 'password_reset') {
			const resetToken = generateResetToken();
			const tokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

			await prisma.verificationToken.deleteMany({
				where: { identifier: `reset:${normalizedEmail}` },
			});

			await prisma.verificationToken.create({
				data: {
					identifier: `reset:${normalizedEmail}`,
					token: resetToken,
					expires: tokenExpiry,
				},
			});

			return NextResponse.json(
				{
					message: 'OTP verified successfully',
					verified: true,
					resetToken,
					email: user.email,
				},
				{ status: 200 },
			);
		}

		return NextResponse.json(
			{
				message: 'Email verified successfully',
				verified: true,
				email: user.email,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Verify OTP error:', error);
		return NextResponse.json({ error: 'An error occurred during verification' }, { status: 500 });
	}
}
