import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from '@/lib/rate-limit';
import { generateOTP, sendOTPEmail } from '@/lib/email';
import { sendOtpSms } from '@/lib/sms';
import { isSupportedPhoneCountry, validatePhoneByCountry } from '@/lib/phone';
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
		const { email, phoneNumber, country, purpose } = body as {
			email?: string;
			phoneNumber?: string;
			country?: string;
			purpose?: OtpPurpose;
		};

		if (!email && !phoneNumber) {
			return NextResponse.json({ error: 'Email or phone number is required' }, { status: 400 });
		}

		const otpPurpose: OtpPurpose = phoneNumber
			? purpose === 'phone_signup'
				? 'phone_signup'
				: purpose === 'phone_update'
					? 'phone_update'
					: 'phone_login'
			: purpose === 'password_reset'
				? 'password_reset'
				: purpose === 'login_otp'
					? 'login_otp'
					: 'email_verification';
		const normalizedEmail = email ? normalizeEmail(email) : '';

		if (!phoneNumber) {
			// Email flow
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
		}

		// Phone flow
		const normalizedCountry = country?.toUpperCase() || '';
		if (!normalizedCountry || !isSupportedPhoneCountry(normalizedCountry)) {
			return NextResponse.json({ error: 'A supported country is required for phone OTP' }, { status: 400 });
		}
		const validated = validatePhoneByCountry(phoneNumber, normalizedCountry);
		if (!validated.valid || !validated.normalized) {
			return NextResponse.json({ error: validated.error || 'Invalid phone number' }, { status: 400 });
		}
		const phoneE164 = validated.normalized.e164;

		if (otpPurpose === 'phone_signup') {
			const user = await prisma.user.findFirst({ where: { phone_number: phoneE164 } });
			if (!user) {
				return NextResponse.json({ error: 'No signup found for this phone number' }, { status: 404 });
			}
			if (user.phoneVerified) {
				return NextResponse.json({ error: 'Phone number is already verified' }, { status: 400 });
			}
		}

		if (otpPurpose === 'phone_login') {
			const user = await prisma.user.findFirst({ where: { phone_number: phoneE164 } });
			if (!user || !user.phoneVerified) {
				return NextResponse.json(
					{ error: 'Please verify your phone number before logging in.' },
					{ status: 400 },
				);
			}
		}

		if (otpPurpose === 'phone_update') {
			const session = await getServerSession(authOptions);
			if (!session?.user?.id) {
				return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
			}

			const existing = await prisma.user.findFirst({ where: { phone_number: phoneE164 } });
			if (existing && existing.id !== session.user.id) {
				return NextResponse.json({ error: 'Phone number already in use by another account.' }, { status: 409 });
			}
		}

		const otp = generateOTP();
		const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
		const otpIdentifier = getOtpIdentifier(phoneE164, otpPurpose);

		await prisma.verificationToken.deleteMany({
			where: { identifier: otpIdentifier },
		});

		await prisma.verificationToken.create({
			data: {
				identifier: otpIdentifier,
				token: hashOtp(otp, phoneE164, otpPurpose),
				expires: otpExpiry,
			},
		});

		try {
			await sendOtpSms({
				toE164: phoneE164,
				code: otp,
				context: otpPurpose === 'phone_update' ? 'update_phone' : otpPurpose === 'phone_signup' ? 'signup' : 'login',
			});
		} catch (sendErr) {
			console.error('Resend phone OTP SMS failed:', sendErr);
			await prisma.verificationToken.deleteMany({ where: { identifier: otpIdentifier } });
			return NextResponse.json(
				{
					error:
						sendErr instanceof Error
							? sendErr.message
							: 'An error occurred while resending the code',
				},
				{ status: 502 },
			);
		}

		return NextResponse.json({ message: 'A new verification code has been sent to your phone.' }, { status: 200 });
	} catch (error) {
		console.error('Resend OTP error:', error);
		return NextResponse.json({ error: 'An error occurred while resending the code' }, { status: 500 });
	}
}
