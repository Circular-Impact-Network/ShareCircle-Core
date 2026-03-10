import { describe, expect, it } from 'vitest';
import { getOtpIdentifier, hashOtp } from '@/lib/otp';

describe('phone OTP helpers', () => {
	it('builds deterministic identifiers for phone purposes', () => {
		const identifier = getOtpIdentifier('+91 98765 43210', 'phone_login');
		expect(identifier).toBe('otp:phone_login:+919876543210');
	});

	it('hashes same phone OTP payload consistently', () => {
		const first = hashOtp('123456', '+1 202 555 0101', 'phone_signup');
		const second = hashOtp('123456', '+12025550101', 'phone_signup');
		expect(first).toBe(second);
	});
});
