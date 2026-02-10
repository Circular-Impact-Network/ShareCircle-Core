import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { checkRateLimit, getClientIdentifier, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { validatePassword, getPasswordRequirementsText } from '@/lib/password-validation';
import { generateOTP, sendOTPEmail } from '@/lib/email';
import { getOtpIdentifier, hashOtp, normalizeEmail } from '@/lib/otp';

export async function POST(req: NextRequest) {
	try {
		// Rate limiting for auth endpoints to prevent abuse
		const clientIdentifier = getClientIdentifier(req);
		const rateLimitResult = checkRateLimit(clientIdentifier, 'auth-signup', RATE_LIMITS.auth);
		if (!rateLimitResult.success) {
			return rateLimitResponse(rateLimitResult);
		}

		const body = await req.json();
		const { name, email, password, phoneNumber, countryCode } = body;
		const normalizedEmail = email ? normalizeEmail(email) : '';

		// Validation
		if (!name || (!email && !phoneNumber) || !password) {
			return NextResponse.json(
				{ error: 'Name, password, and either email or phone number are required' },
				{ status: 400 },
			);
		}

		if (!normalizedEmail) {
			return NextResponse.json({ error: 'Email signup is required at this time' }, { status: 400 });
		}

		// Validate email format if provided
		if (normalizedEmail) {
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(normalizedEmail)) {
				return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
			}
		}

		// Validate password strength
		const passwordValidation = validatePassword(password);
		if (!passwordValidation.isValid) {
			return NextResponse.json(
				{
					error: passwordValidation.errors[0],
					details: passwordValidation.errors,
					requirements: getPasswordRequirementsText(),
				},
				{ status: 400 },
			);
		}

		// Check if user already exists
		if (normalizedEmail) {
			const existingUser = await prisma.user.findUnique({
				where: { email: normalizedEmail },
			});

			if (existingUser) {
				return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
			}
		}

		if (phoneNumber) {
			// Note: phone_number is not unique in schema currently, but we should check
			const existingUserByPhone = await prisma.user.findFirst({
				where: { phone_number: phoneNumber },
			});

			if (existingUserByPhone) {
				return NextResponse.json({ error: 'User with this phone number already exists' }, { status: 409 });
			}
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(password, 12);

		// In e2e tests, auto-verify so test users can log in without going through OTP
		const emailVerified =
			process.env.E2E_AUTO_VERIFY === 'true' ? new Date() : undefined;

		// Create user (emailVerified is null until OTP is verified, unless E2E_AUTO_VERIFY)
		const user = await prisma.user.create({
			data: {
				name,
				email: normalizedEmail || `${phoneNumber}@phone.sharecircle.com`,
				hashed_password: hashedPassword,
				phone_number: phoneNumber,
				country_code: countryCode,
				...(emailVerified && { emailVerified }),
			},
			select: {
				id: true,
				name: true,
				email: true,
				created_at: true,
			},
		});

		// Generate OTP and store hashed token
		const otp = generateOTP();
		const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
		const identifier = getOtpIdentifier(normalizedEmail, 'email_verification');

		await prisma.verificationToken.deleteMany({
			where: { identifier },
		});

		await prisma.verificationToken.create({
			data: {
				identifier,
				token: hashOtp(otp, normalizedEmail, 'email_verification'),
				expires: otpExpiry,
			},
		});

		// Send OTP email (only if GMAIL credentials are configured)
		if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
			try {
				await sendOTPEmail(normalizedEmail, otp, 'email_verification');
			} catch (emailError) {
				console.error('Failed to send OTP email:', emailError);
				// Don't fail signup if email fails - user can request resend
			}
		} else {
			console.warn('GMAIL credentials not configured - OTP email not sent');
		}

		return NextResponse.json(
			{
				message: 'User created successfully. Please verify your email.',
				requiresVerification: true,
				email: user.email,
				user,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error('Signup error:', error);
		return NextResponse.json({ error: 'An error occurred during signup' }, { status: 500 });
	}
}
