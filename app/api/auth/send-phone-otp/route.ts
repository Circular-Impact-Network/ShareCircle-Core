import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, getClientIdentifier, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { isSupportedPhoneCountry, validatePhoneByCountry } from '@/lib/phone';
import { generateOTP } from '@/lib/email';
import { getOtpIdentifier, hashOtp, OtpPurpose } from '@/lib/otp';
import { prisma } from '@/lib/prisma';
import { sendOtpSms } from '@/lib/sms';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';

type SendPhoneOtpBody = {
	country?: string;
	phoneNumber?: string;
	purpose?: OtpPurpose;
};

const PHONE_PURPOSES: OtpPurpose[] = ['phone_signup', 'phone_login', 'phone_update'];

export async function POST(req: NextRequest) {
	try {
		const identifier = getClientIdentifier(req);
		const rateLimitResult = checkRateLimit(identifier, 'auth-send-phone-otp', RATE_LIMITS.auth);
		if (!rateLimitResult.success) {
			return rateLimitResponse(rateLimitResult);
		}

		const body = (await req.json()) as SendPhoneOtpBody;
		const normalizedCountry = body.country?.toUpperCase() || '';
		const purpose = PHONE_PURPOSES.includes(body.purpose || 'phone_login') ? body.purpose || 'phone_login' : 'phone_login';

		if (!body.phoneNumber || !normalizedCountry || !isSupportedPhoneCountry(normalizedCountry)) {
			return NextResponse.json({ error: 'Phone number and supported country are required' }, { status: 400 });
		}

		const validated = validatePhoneByCountry(body.phoneNumber, normalizedCountry);
		if (!validated.valid || !validated.normalized) {
			return NextResponse.json({ error: validated.error || 'Invalid phone number' }, { status: 400 });
		}

		const phoneE164 = validated.normalized.e164;

		if (purpose === 'phone_signup') {
			const existing = await prisma.user.findFirst({ where: { phone_number: phoneE164 } });
			if (existing) {
				return NextResponse.json({ error: 'User with this phone number already exists' }, { status: 409 });
			}
		}

		if (purpose === 'phone_login') {
			const existing = await prisma.user.findFirst({ where: { phone_number: phoneE164 } });
			if (!existing || !existing.phoneVerified) {
				return NextResponse.json(
					{ error: 'No verified account found for this phone number.' },
					{ status: 400 },
				);
			}
		}

		if (purpose === 'phone_update') {
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
		const otpIdentifier = getOtpIdentifier(phoneE164, purpose);

		await prisma.verificationToken.deleteMany({ where: { identifier: otpIdentifier } });
		await prisma.verificationToken.create({
			data: {
				identifier: otpIdentifier,
				token: hashOtp(otp, phoneE164, purpose),
				expires: otpExpiry,
			},
		});

		try {
			await sendOtpSms({
				toE164: phoneE164,
				code: otp,
				context: purpose === 'phone_update' ? 'update_phone' : purpose === 'phone_signup' ? 'signup' : 'login',
			});
		} catch (sendErr) {
			console.error('Send phone OTP SMS failed:', sendErr);
			await prisma.verificationToken.deleteMany({ where: { identifier: otpIdentifier } });
			return NextResponse.json(
				{
					error:
						sendErr instanceof Error ? sendErr.message : 'Failed to send verification code',
				},
				{ status: 502 },
			);
		}

		return NextResponse.json({
			message: 'A verification code has been sent to your phone number.',
			phoneNumber: phoneE164,
		});
	} catch (error) {
		console.error('Send phone OTP error:', error);
		return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
	}
}
