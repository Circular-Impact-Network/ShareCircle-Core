import twilio from 'twilio';

type OtpSmsContext = 'signup' | 'login' | 'update_phone';

type SendOtpSmsInput = {
	toE164: string;
	code: string;
	context: OtpSmsContext;
};

function canSkipSms(): boolean {
	return process.env.SKIP_SMS === 'true' || process.env.E2E_AUTO_VERIFY === 'true';
}

function getOtpSmsMessage(code: string, context: OtpSmsContext): string {
	const action =
		context === 'signup'
			? 'create your ShareCircle account'
			: context === 'login'
				? 'log in to ShareCircle'
				: 'confirm your phone number update in ShareCircle';

	return `Your ShareCircle OTP is ${code}. Use it to ${action}. This code expires in 10 minutes. Do not share this code.`;
}

function getTwilioClient() {
	const accountSid = process.env.TWILIO_ACCOUNT_SID;
	const authToken = process.env.TWILIO_AUTH_TOKEN;
	if (!accountSid || !authToken) {
		return null;
	}
	return twilio(accountSid, authToken);
}

export async function sendOtpSms({ toE164, code, context }: SendOtpSmsInput): Promise<void> {
	if (canSkipSms()) {
		console.log(`[SMS Test Mode] Skipping SMS to ${toE164} (OTP: ${code})`);
		return;
	}

	const client = getTwilioClient();
	const fromNumber = process.env.TWILIO_PHONE_NUMBER;
	if (!client || !fromNumber) {
		throw new Error(
			'Twilio SMS is not configured. Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN or TWILIO_PHONE_NUMBER.',
		);
	}

	try {
		await client.messages.create({
			to: toE164,
			from: fromNumber,
			body: getOtpSmsMessage(code, context),
		});
	} catch (error) {
		console.error('Twilio SMS send failed:', error);
		const twilioCode =
			error &&
			typeof error === 'object' &&
			'code' in error &&
			typeof (error as { code: unknown }).code === 'number'
				? (error as { code: number }).code
				: undefined;
		// 21608: trial account — destination not verified in Twilio Console
		if (twilioCode === 21608) {
			throw new Error(
				'SMS could not be sent to this number. Twilio trial accounts can only message verified numbers—verify it in the Twilio Console or use a paid account for production.',
			);
		}
		throw new Error('Failed to send SMS verification code. Please try again.');
	}
}
