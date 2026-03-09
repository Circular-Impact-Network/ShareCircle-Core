import { afterEach, describe, expect, it, vi } from 'vitest';

const messagesCreate = vi.fn();

vi.mock('twilio', () => ({
	default: () => ({
		messages: {
			create: (...args: unknown[]) => messagesCreate(...args),
		},
	}),
}));

import { sendOtpSms } from '@/lib/sms';

describe('sms service', () => {
	afterEach(() => {
		delete process.env.SKIP_SMS;
		delete process.env.E2E_AUTO_VERIFY;
		delete process.env.TWILIO_ACCOUNT_SID;
		delete process.env.TWILIO_AUTH_TOKEN;
		delete process.env.TWILIO_PHONE_NUMBER;
		messagesCreate.mockReset();
		vi.restoreAllMocks();
	});

	it('skips sending when SKIP_SMS is enabled', async () => {
		process.env.SKIP_SMS = 'true';
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

		await expect(
			sendOtpSms({
				toE164: '+919876543210',
				code: '123456',
				context: 'login',
			}),
		).resolves.toBeUndefined();

		expect(logSpy).toHaveBeenCalled();
	});

	it('maps Twilio 21608 (trial / unverified destination) to a clear error', async () => {
		process.env.TWILIO_ACCOUNT_SID = 'ACtest';
		process.env.TWILIO_AUTH_TOKEN = 'test_token';
		process.env.TWILIO_PHONE_NUMBER = '+15551234567';
		messagesCreate.mockRejectedValue({ code: 21608, message: 'unverified' });
		vi.spyOn(console, 'error').mockImplementation(() => undefined);

		await expect(
			sendOtpSms({
				toE164: '+919876543210',
				code: '123456',
				context: 'login',
			}),
		).rejects.toThrow(/Twilio trial/);
	});
});
