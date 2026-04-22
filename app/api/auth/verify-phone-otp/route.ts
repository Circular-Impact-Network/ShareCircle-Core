import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIdentifier, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { getOtpIdentifier, hashOtp, OtpPurpose, timingSafeEqualHex } from '@/lib/otp';
import { isSupportedPhoneCountry, validatePhoneByCountry } from '@/lib/phone';

type VerifyPhoneOtpBody = {
	country?: string;
	phoneNumber?: string;
	code?: string;
	purpose?: OtpPurpose;
};

const PHONE_PURPOSES: OtpPurpose[] = ['phone_signup', 'phone_login', 'phone_update'];

export async function POST(req: NextRequest) {
	try {
		const identifier = getClientIdentifier(req);
		const rateLimitResult = checkRateLimit(identifier, 'auth-verify-phone-otp', RATE_LIMITS.auth);
		if (!rateLimitResult.success) {
			return rateLimitResponse(rateLimitResult);
		}

		const body = (await req.json()) as VerifyPhoneOtpBody;
		const normalizedCountry = body.country?.toUpperCase() || '';
		const purpose = PHONE_PURPOSES.includes(body.purpose || 'phone_login')
			? body.purpose || 'phone_login'
			: 'phone_login';

		if (!body.phoneNumber || !body.code || !normalizedCountry || !isSupportedPhoneCountry(normalizedCountry)) {
			return NextResponse.json(
				{ error: 'Phone number, country, and verification code are required' },
				{ status: 400 },
			);
		}

		const validated = validatePhoneByCountry(body.phoneNumber, normalizedCountry);
		if (!validated.valid || !validated.normalized) {
			return NextResponse.json({ error: validated.error || 'Invalid phone number' }, { status: 400 });
		}

		const phoneE164 = validated.normalized.e164;
		const otpIdentifier = getOtpIdentifier(phoneE164, purpose);
		const verificationToken = await prisma.verificationToken.findFirst({ where: { identifier: otpIdentifier } });

		if (!verificationToken) {
			return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
		}

		if (new Date() > verificationToken.expires) {
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

		const expected = hashOtp(body.code, phoneE164, purpose);
		const matches =
			verificationToken.token.length <= 8
				? verificationToken.token === body.code
				: timingSafeEqualHex(verificationToken.token, expected);
		if (!matches) {
			return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
		}

		await prisma.verificationToken.delete({
			where: {
				identifier_token: {
					identifier: otpIdentifier,
					token: verificationToken.token,
				},
			},
		});

		if (purpose === 'phone_update') {
			const session = await getServerSession(authOptions);
			if (!session?.user?.id) {
				return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
			}

			const existing = await prisma.user.findFirst({ where: { phone_number: phoneE164 } });
			if (existing && existing.id !== session.user.id) {
				return NextResponse.json({ error: 'Phone number already in use by another account.' }, { status: 409 });
			}

			await prisma.user.update({
				where: { id: session.user.id },
				data: {
					phone_number: phoneE164,
					country_code: validated.normalized.dialCode,
					phoneVerified: new Date(),
				},
			});
		}

		if (purpose === 'phone_signup') {
			await prisma.user.updateMany({
				where: { phone_number: phoneE164 },
				data: {
					phoneVerified: new Date(),
				},
			});
		}

		return NextResponse.json({
			message: 'Phone number verified successfully',
			verified: true,
			phoneNumber: phoneE164,
		});
	} catch (error) {
		console.error('Verify phone OTP error:', error);
		return NextResponse.json({ error: 'An error occurred during verification' }, { status: 500 });
	}
}
