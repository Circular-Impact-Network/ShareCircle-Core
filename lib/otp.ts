import crypto from 'crypto';

export type OtpPurpose = 'email_verification' | 'password_reset' | 'login_otp';

const OTP_SECRET = process.env.NEXTAUTH_SECRET || 'sharecircle-otp';

export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export function getOtpIdentifier(email: string, purpose: OtpPurpose): string {
	return `otp:${purpose}:${normalizeEmail(email)}`;
}

export function hashOtp(otp: string, email: string, purpose: OtpPurpose): string {
	const value = `${otp}:${normalizeEmail(email)}:${purpose}:${OTP_SECRET}`;
	return crypto.createHash('sha256').update(value).digest('hex');
}

export function timingSafeEqualHex(a: string, b: string): boolean {
	const aBuffer = Buffer.from(a, 'hex');
	const bBuffer = Buffer.from(b, 'hex');
	if (aBuffer.length !== bBuffer.length) {
		return false;
	}
	return crypto.timingSafeEqual(aBuffer, bBuffer);
}
