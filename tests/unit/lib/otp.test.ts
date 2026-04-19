import { describe, it, expect } from 'vitest';
import { normalizeEmail, normalizePhoneE164, getOtpIdentifier, hashOtp, timingSafeEqualHex } from '@/lib/otp';

describe('otp utilities', () => {
	describe('normalizeEmail', () => {
		it('trims and lowercases', () => {
			expect(normalizeEmail('  Test@EXAMPLE.com  ')).toBe('test@example.com');
		});

		it('handles already normalized email', () => {
			expect(normalizeEmail('user@test.com')).toBe('user@test.com');
		});
	});

	describe('normalizePhoneE164', () => {
		it('strips non-digit characters', () => {
			expect(normalizePhoneE164('+1 (555) 123-4567')).toBe('+15551234567');
		});

		it('adds + prefix if missing', () => {
			expect(normalizePhoneE164('15551234567')).toBe('+15551234567');
		});

		it('trims whitespace', () => {
			expect(normalizePhoneE164('  +91 9876543210  ')).toBe('+919876543210');
		});
	});

	describe('getOtpIdentifier', () => {
		it('creates email-based identifier', () => {
			const id = getOtpIdentifier('test@example.com', 'email_verification');
			expect(id).toBe('otp:email_verification:test@example.com');
		});

		it('creates phone-based identifier with normalization', () => {
			const id = getOtpIdentifier('+1 555 1234567', 'phone_signup');
			expect(id).toBe('otp:phone_signup:+15551234567');
		});

		it('normalizes email in identifier', () => {
			const id = getOtpIdentifier('TEST@Example.COM', 'login_otp');
			expect(id).toBe('otp:login_otp:test@example.com');
		});
	});

	describe('hashOtp', () => {
		it('produces a hex string', () => {
			const hash = hashOtp('123456', 'test@example.com', 'email_verification');
			expect(hash).toMatch(/^[a-f0-9]{64}$/);
		});

		it('is deterministic', () => {
			const a = hashOtp('123456', 'test@example.com', 'email_verification');
			const b = hashOtp('123456', 'test@example.com', 'email_verification');
			expect(a).toBe(b);
		});

		it('differs for different OTPs', () => {
			const a = hashOtp('123456', 'test@example.com', 'email_verification');
			const b = hashOtp('654321', 'test@example.com', 'email_verification');
			expect(a).not.toBe(b);
		});

		it('differs for different purposes', () => {
			const a = hashOtp('123456', 'test@example.com', 'email_verification');
			const b = hashOtp('123456', 'test@example.com', 'password_reset');
			expect(a).not.toBe(b);
		});
	});

	describe('timingSafeEqualHex', () => {
		it('returns true for matching hex strings', () => {
			const hash = hashOtp('123456', 'test@example.com', 'email_verification');
			expect(timingSafeEqualHex(hash, hash)).toBe(true);
		});

		it('returns false for different hex strings', () => {
			const a = hashOtp('123456', 'test@example.com', 'email_verification');
			const b = hashOtp('654321', 'test@example.com', 'email_verification');
			expect(timingSafeEqualHex(a, b)).toBe(false);
		});

		it('returns false for different length strings', () => {
			expect(timingSafeEqualHex('aabb', 'aabbcc')).toBe(false);
		});
	});
});
