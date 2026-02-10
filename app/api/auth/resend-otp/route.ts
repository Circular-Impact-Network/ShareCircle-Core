import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIdentifier, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { generateOTP, sendOTPEmail } from '@/lib/email';
import { getOtpIdentifier, hashOtp, normalizeEmail, OtpPurpose } from '@/lib/otp';

export async function POST(req: NextRequest) {
	try {
		// Rate limiting - use a stricter limit for resend to prevent abuse
		const identifier = getClientIdentifier(req);
		const rateLimitResult = checkRateLimit(identifier, 'auth-resend-otp', {
			maxRequests: 3, // Only allow 3 resends per window
			windowSeconds: 300, // 5 minute window
		});
		if (!rateLimitResult.success) {
			return rateLimitResponse(rateLimitResult);
		}

		const body = await req.json();
		const { email, purpose } = body as { email?: string; purpose?: OtpPurpose };

		if (!email) {
			return NextResponse.json({ error: 'Email is required' }, { status: 400 });
		}

		const otpPurpose: OtpPurpose =
			purpose === 'password_reset'
				? 'password_reset'
				: purpose === 'login_otp'
					? 'login_otp'
					: 'email_verification';
		const normalizedEmail = normalizeEmail(email);

		// Find the user
		const user = await prisma.user.findUnique({
			where: { email: normalizedEmail },
		});

		if (!user || (otpPurpose === 'password_reset' && !user.hashed_password)) {
			return NextResponse.json(
				{ message: 'If an account exists with this email, a new verification code has been sent.' },
				{ status: 200 },
			);
		}

		if (otpPurpose === 'email_verification' && user.emailVerified) {
			return NextResponse.json({ error: 'Email is already verified' }, { status: 400 });
		}

		if (otpPurpose === 'login_otp' && !user.emailVerified) {
			return NextResponse.json(
				{ error: 'Please verify your email before logging in with a code.' },
				{ status: 400 },
			);
		}

		// Generate new OTP
		const otp = generateOTP();
		const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
		const otpIdentifier = getOtpIdentifier(normalizedEmail, otpPurpose);

		// Delete any existing OTP for this email
		await prisma.verificationToken.deleteMany({
			where: { identifier: otpIdentifier },
		});

		// Store new OTP
		await prisma.verificationToken.create({
			data: {
				identifier: otpIdentifier,
				token: hashOtp(otp, normalizedEmail, otpPurpose),
				expires: otpExpiry,
			},
		});

		// Send OTP email
		if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
			try {
				await sendOTPEmail(normalizedEmail, otp, otpPurpose);
			} catch (emailError) {
				console.error('Failed to send OTP email:', emailError);
				return NextResponse.json(
					{ error: 'Failed to send verification email. Please try again.' },
					{ status: 500 },
				);
			}
		} else {
			console.warn('GMAIL credentials not configured - OTP email not sent');
			return NextResponse.json(
				{ error: 'Email service is not configured. Please try again later.' },
				{ status: 500 },
			);
		}

		return NextResponse.json({ message: 'A new verification code has been sent to your email.' }, { status: 200 });
	} catch (error) {
		console.error('Resend OTP error:', error);
		return NextResponse.json({ error: 'An error occurred while resending the code' }, { status: 500 });
	}
}
