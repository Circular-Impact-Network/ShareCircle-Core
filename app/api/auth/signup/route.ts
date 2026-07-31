import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { checkRateLimit, getClientIdentifier, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { validatePassword, getPasswordRequirementsText } from '@/lib/password-validation';
import { generateOTP, isEmailConfigured, sendOTPEmail } from '@/lib/email';
import { sendOtpSms } from '@/lib/sms';
import { isSupportedPhoneCountry, validatePhoneByCountry } from '@/lib/phone';
import { getOtpIdentifier, hashOtp, normalizeEmail } from '@/lib/otp';
import { z } from 'zod';

/**
 * Signup payload. This route previously did a raw `as` cast with no validation at all.
 *
 * `city` is required: location is mandatory at signup and the client has no manual input,
 * so an absent city means the detection chain was bypassed. `latitude`/`longitude` stay
 * optional because the IP fallback may only resolve a city.
 */
const signupSchema = z.object({
	name: z.string().trim().min(1).max(120).optional(),
	email: z.string().trim().max(320).optional(),
	password: z.string().max(200).optional(),
	phoneNumber: z.string().trim().max(32).optional(),
	country: z.string().trim().max(8).optional(),
	dateOfBirth: z.string().trim().max(32).optional(),
	latitude: z.number().min(-90).max(90).optional(),
	longitude: z.number().min(-180).max(180).optional(),
	city: z.string().trim().min(1, 'Location is required to sign up.').max(120),
	state: z.string().trim().max(120).optional(),
	zipCode: z.string().trim().max(32).optional(),
	// Geocoded country NAME (distinct from `country`, which is the phone country CODE).
	countryName: z.string().trim().max(120).optional(),
});

export async function POST(req: NextRequest) {
	try {
		const clientIdentifier = getClientIdentifier(req);
		const rateLimitResult = checkRateLimit(clientIdentifier, 'auth-signup', RATE_LIMITS.auth);
		if (!rateLimitResult.success) {
			return rateLimitResponse(rateLimitResult);
		}

		const parsedBody = signupSchema.safeParse(await req.json());
		if (!parsedBody.success) {
			return NextResponse.json(
				{ error: parsedBody.error.issues[0]?.message || 'Invalid signup details' },
				{ status: 400 },
			);
		}
		const body = parsedBody.data;
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
		const isAutoVerified = process.env.NODE_ENV !== 'production' && process.env.E2E_AUTO_VERIFY === 'true';
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
				// Written unconditionally where present: the old truthiness spreads silently
				// dropped a literal 0 latitude/longitude (equator / prime meridian).
				latitude: body.latitude ?? null,
				longitude: body.longitude ?? null,
				city: body.city,
				state: body.state ?? null,
				zip_code: body.zipCode ?? null,
				country: body.countryName ?? null,
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

		let emailSent = false;
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
		} else {
			// Persist OTP for e2e test retrieval — allowed in dev or when TEST_CLEANUP_SECRET is set (CI prod build)
			if (
				(process.env.NODE_ENV !== 'production' || !!process.env.TEST_CLEANUP_SECRET) &&
				/^e2e\+.+@example\.com$/i.test(normalizedEmail)
			) {
				await prisma.testOtp.create({ data: { email: normalizedEmail, otp } });
			}

			if (isEmailConfigured()) {
				try {
					await sendOTPEmail(normalizedEmail, otp, 'email_verification');
					emailSent = true;
				} catch (emailError) {
					console.error('Failed to send OTP email:', emailError);
				}
			} else {
				console.warn('Email is not configured (RESEND_API_KEY) - OTP email not sent');
			}
		}

		return NextResponse.json(
			{
				message: phoneE164
					? 'User created successfully. Please verify your phone number.'
					: emailSent
						? 'User created successfully. Please verify your email.'
						: "Account created, but we couldn't send your verification email. Tap Resend to try again.",
				requiresVerification: true,
				// For email signups, tells the client whether the OTP actually went out so it can
				// prompt the user to resend instead of waiting on an email that never arrives.
				emailSent: phoneE164 ? undefined : emailSent,
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
