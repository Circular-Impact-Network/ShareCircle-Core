import crypto from 'crypto';

export type OtpPurpose =
	| 'email_verification'
	| 'password_reset'
	| 'login_otp'
	| 'phone_signup'
	| 'phone_login'
	| 'phone_update';

const OTP_SECRET = process.env.NEXTAUTH_SECRET || 'sharecircle-otp';

export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export function normalizePhoneE164(phoneE164: string): string {
	const normalized = phoneE164.trim().replace(/\s+/g, '');
	if (!normalized.startsWith('+')) {
		return `+${normalized.replace(/\D/g, '')}`;
	}
	return `+${normalized.slice(1).replace(/\D/g, '')}`;
}

function isPhonePurpose(purpose: OtpPurpose): boolean {
	return purpose === 'phone_signup' || purpose === 'phone_login' || purpose === 'phone_update';
}

export function getOtpIdentifier(target: string, purpose: OtpPurpose): string {
	const normalizedTarget = isPhonePurpose(purpose) ? normalizePhoneE164(target) : normalizeEmail(target);
	return `otp:${purpose}:${normalizedTarget}`;
}

export function hashOtp(otp: string, target: string, purpose: OtpPurpose): string {
	const normalizedTarget = isPhonePurpose(purpose) ? normalizePhoneE164(target) : normalizeEmail(target);
	const value = `${otp}:${normalizedTarget}:${purpose}:${OTP_SECRET}`;
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
