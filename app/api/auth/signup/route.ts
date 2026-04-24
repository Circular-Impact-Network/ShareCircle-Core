import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { checkRateLimit, getClientIdentifier, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { validatePassword, getPasswordRequirementsText } from '@/lib/password-validation';
import { generateOTP, sendOTPEmail } from '@/lib/email';
import { sendOtpSms } from '@/lib/sms';
import { isSupportedPhoneCountry, validatePhoneByCountry } from '@/lib/phone';
import { getOtpIdentifier, hashOtp, normalizeEmail } from '@/lib/otp';

export async function POST(req: NextRequest) {
	try {
		const clientIdentifier = getClientIdentifier(req);
		const rateLimitResult = checkRateLimit(clientIdentifier, 'auth-signup', RATE_LIMITS.auth);
		if (!rateLimitResult.success) {
			return rateLimitResponse(rateLimitResult);
		}

		const body = (await req.json()) as {
			name?: string;
			email?: string;
			password?: string;
			phoneNumber?: string;
			country?: string;
			dateOfBirth?: string;
			latitude?: number;
			longitude?: number;
			city?: string;
		};
		const normalizedEmail = body.email ? normalizeEmail(body.email) : '';
		const normalizedName = body.name?.trim() || 'User';
		const normalizedCountry = body.country?.toUpperCase() || '';

		if (!normalizedEmail && !body.phoneNumber) {
			return NextResponse.json({ error: 'Either email or phone number is required' }, { status: 400 });
		}

		if (normalizedEmail) {
			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
			if (!emailRegex.test(normalizedEmail)) {
				return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
			}
		}

		if ((normalizedEmail || !body.phoneNumber) && !body.password) {
			return NextResponse.json({ error: 'Password is required for this signup method' }, { status: 400 });
		}

		if (body.password) {
			const passwordValidation = validatePassword(body.password);
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
		}

		const hasPhone = Boolean(body.phoneNumber);
		let phoneE164: string | undefined;
		let dialCode: string | undefined;

		if (hasPhone) {
			if (!normalizedCountry || !isSupportedPhoneCountry(normalizedCountry)) {
				return NextResponse.json(
					{ error: 'A supported country is required for phone signup' },
					{ status: 400 },
				);
			}

			const validated = validatePhoneByCountry(body.phoneNumber!, normalizedCountry);
			if (!validated.valid || !validated.normalized) {
				return NextResponse.json({ error: validated.error || 'Invalid phone number' }, { status: 400 });
			}

			phoneE164 = validated.normalized.e164;
			dialCode = validated.normalized.dialCode;
		}

		if (normalizedEmail) {
			const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
			if (existingUser) {
				return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
			}
		}

		if (phoneE164) {
			const existingUserByPhone = await prisma.user.findFirst({ where: { phone_number: phoneE164 } });
			if (existingUserByPhone) {
				return NextResponse.json({ error: 'User with this phone number already exists' }, { status: 409 });
			}
		}

		const hashedPassword = body.password ? await bcrypt.hash(body.password, 12) : undefined;
		const isAutoVerified = process.env.E2E_AUTO_VERIFY === 'true';
		const emailVerified = normalizedEmail && isAutoVerified ? new Date() : undefined;
		const phoneVerified = phoneE164 && isAutoVerified ? new Date() : undefined;

		const user = await prisma.user.create({
			data: {
				name: normalizedName,
				email: normalizedEmail || undefined,
				hashed_password: hashedPassword,
				phone_number: phoneE164,
				country_code: dialCode,
				...(emailVerified && { emailVerified }),
				...(phoneVerified && { phoneVerified }),
				...(body.dateOfBirth && { date_of_birth: new Date(body.dateOfBirth) }),
				...(body.latitude !== undefined && { latitude: body.latitude }),
				...(body.longitude !== undefined && { longitude: body.longitude }),
				...(body.city && { city: body.city }),
			},
			select: {
				id: true,
				name: true,
				email: true,
				created_at: true,
			},
		});

		const otp = generateOTP();
		const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
		const purpose = phoneE164 ? 'phone_signup' : 'email_verification';
		const otpTarget = phoneE164 || normalizedEmail;
		const identifier = getOtpIdentifier(otpTarget, purpose);

		await prisma.verificationToken.deleteMany({ where: { identifier } });
		await prisma.verificationToken.create({
			data: {
				identifier,
				token: hashOtp(otp, otpTarget, purpose),
				expires: otpExpiry,
			},
		});

		if (phoneE164) {
			try {
				await sendOtpSms({ toE164: phoneE164, code: otp, context: 'signup' });
			} catch (smsError) {
				console.error('Failed to send OTP SMS:', smsError);
				await prisma.verificationToken.deleteMany({ where: { identifier } });
				await prisma.user.delete({ where: { id: user.id } });
				return NextResponse.json(
					{
						error:
							smsError instanceof Error
								? smsError.message
								: 'Failed to send verification SMS. Please try again.',
					},
					{ status: 502 },
				);
			}
		} else if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
			try {
				await sendOTPEmail(normalizedEmail, otp, 'email_verification');
			} catch (emailError) {
				console.error('Failed to send OTP email:', emailError);
			}
		} else {
			console.warn('GMAIL credentials not configured - OTP email not sent');
		}

		return NextResponse.json(
			{
				message: phoneE164
					? 'User created successfully. Please verify your phone number.'
					: 'User created successfully. Please verify your email.',
				requiresVerification: true,
				email: user.email,
				phoneNumber: phoneE164,
				user,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error('Signup error:', error);
		return NextResponse.json({ error: 'An error occurred during signup' }, { status: 500 });
	}
}
