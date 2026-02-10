import { IrisMail } from 'irismail/server';
import type { OtpPurpose } from './otp';

const BRAND = {
	name: 'ShareCircle',
	primary: '#34a85a',
	ink: '#111827',
	muted: '#6b7280',
	panel: '#ffffff',
	background: '#f3f6f4',
	border: '#e5e7eb',
};

function wrapEmailHtml(title: string, preview: string, content: string) {
	return `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="utf-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>${title}</title>
		</head>
		<body style="margin:0; padding:0; background:${BRAND.background}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color:${BRAND.ink};">
			<span style="display:none; visibility:hidden; opacity:0; height:0; width:0; overflow:hidden;">${preview}</span>
			<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${BRAND.background}; padding:24px 0;">
				<tr>
					<td align="center">
						<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background:${BRAND.panel}; border-radius:16px; border:1px solid ${BRAND.border}; padding:32px;">
							<tr>
								<td align="center" style="padding-bottom:24px;">
									<div style="display:inline-flex; align-items:center; gap:10px;">
										<div style="width:40px; height:40px; border-radius:10px; background:${BRAND.primary}; display:inline-flex; align-items:center; justify-content:center; color:#fff; font-weight:700;">
											SC
										</div>
										<span style="font-size:20px; font-weight:700; color:${BRAND.ink};">${BRAND.name}</span>
									</div>
								</td>
							</tr>
							${content}
							<tr>
								<td style="padding-top:24px; font-size:12px; color:${BRAND.muted}; text-align:center;">
									If you didn’t request this, you can safely ignore this email.
								</td>
							</tr>
						</table>
						<div style="font-size:12px; color:${BRAND.muted}; padding-top:16px;">
							© ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.
						</div>
					</td>
				</tr>
			</table>
		</body>
		</html>
	`;
}

// Lazy-initialize IrisMail so the app does not throw when Gmail env vars are missing (e.g. e2e tests).
let mailInstance: InstanceType<typeof IrisMail> | null = null;

function getMail(): InstanceType<typeof IrisMail> | null {
	// Skip email sending during E2E tests
	if (process.env.E2E_AUTO_VERIFY === 'true' || process.env.SKIP_EMAIL === 'true') {
		return null;
	}
	if (mailInstance) return mailInstance;
	const user = process.env.GMAIL_USER;
	const pass = process.env.GMAIL_APP_PASSWORD;
	if (!user || !pass) return null;
	mailInstance = new IrisMail({ auth: { user, pass } });
	return mailInstance;
}

/**
 * Send OTP verification email for signup
 * @param to - Recipient email address
 * @param otp - 6-digit OTP code
 * @returns Promise that resolves when email is sent
 */
export async function sendOTPEmail(to: string, otp: string, purpose: OtpPurpose): Promise<void> {
	const isVerification = purpose === 'email_verification';
	const isLogin = purpose === 'login_otp';
	const subject = isVerification
		? 'Verify your email - ShareCircle'
		: isLogin
			? 'Your login code - ShareCircle'
			: 'Reset your password - ShareCircle';
	const title = isVerification ? 'Verify your email' : isLogin ? 'Log in with code' : 'Reset your password';
	const preview = isVerification
		? 'Use this code to verify your ShareCircle account.'
		: isLogin
			? 'Use this code to log in to your ShareCircle account.'
			: 'Use this code to confirm your password reset.';
	const message = isVerification
		? 'Use the code below to verify your email address and finish setting up your account.'
		: isLogin
			? 'Use the code below to securely log in. This code is one-time and expires soon.'
			: 'Use the code below to confirm your password reset request.';

	const html = wrapEmailHtml(
		title,
		preview,
		`
			<tr>
				<td style="text-align:center; padding-bottom:16px;">
					<h1 style="margin:0; font-size:24px;">${title}</h1>
				</td>
			</tr>
			<tr>
				<td style="text-align:center; color:${BRAND.muted}; font-size:14px; padding-bottom:24px;">
					${message}
				</td>
			</tr>
			<tr>
				<td align="center">
					<div style="display:inline-block; background:${BRAND.background}; border:1px solid ${BRAND.border}; border-radius:12px; padding:18px 24px;">
						<span style="font-size:28px; letter-spacing:8px; font-weight:700; color:${BRAND.primary};">${otp}</span>
					</div>
					<div style="margin-top:12px; font-size:12px; color:${BRAND.muted};">
						This code expires in 10 minutes.
					</div>
				</td>
			</tr>
		`,
	);

	const client = getMail();
	if (!client) {
		if (process.env.E2E_AUTO_VERIFY === 'true') {
			console.log(`[E2E Test Mode] Skipping OTP email to ${to} (OTP: ${otp})`);
		} else {
			console.warn('Email sending disabled - GMAIL_USER/GMAIL_APP_PASSWORD not set or SKIP_EMAIL=true');
		}
		return;
	}
	await client.sendMail({
		from: process.env.GMAIL_USER!,
		to,
		subject,
		html,
	});
}

/**
 * Send password reset email
 * @param to - Recipient email address
 * @param resetToken - Unique reset token
 * @returns Promise that resolves when email is sent
 */
export async function sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
	const resetUrl = `${process.env.NEXTAUTH_URL}/login?mode=reset&token=${resetToken}`;

	const html = wrapEmailHtml(
		'Reset your password',
		'Use this link to reset your ShareCircle password.',
		`
			<tr>
				<td style="text-align:center; padding-bottom:16px;">
					<h1 style="margin:0; font-size:24px;">Reset your password</h1>
				</td>
			</tr>
			<tr>
				<td style="text-align:center; color:${BRAND.muted}; font-size:14px; padding-bottom:24px;">
					Click the button below to reset your password. This link expires in 1 hour.
				</td>
			</tr>
			<tr>
				<td align="center" style="padding-bottom:24px;">
					<a href="${resetUrl}" style="display:inline-block; background:${BRAND.primary}; color:#fff; text-decoration:none; padding:12px 24px; border-radius:10px; font-weight:600;">
						Reset Password
					</a>
				</td>
			</tr>
			<tr>
				<td style="font-size:12px; color:${BRAND.muted}; text-align:center;">
					If the button doesn&apos;t work, copy and paste this link into your browser:<br/>
					<span style="color:${BRAND.primary}; word-break:break-all;">${resetUrl}</span>
				</td>
			</tr>
		`,
	);

	const client = getMail();
	if (!client) {
		if (process.env.E2E_AUTO_VERIFY === 'true') {
			console.log(`[E2E Test Mode] Skipping password reset email to ${to} (token: ${resetToken})`);
		} else {
			console.warn('Email sending disabled - GMAIL_USER/GMAIL_APP_PASSWORD not set or SKIP_EMAIL=true');
		}
		return;
	}
	await client.sendMail({
		from: process.env.GMAIL_USER!,
		to,
		subject: 'Reset your password - ShareCircle',
		html,
	});
}

/**
 * Generate a 6-digit OTP code
 * @returns 6-digit string
 */
export function generateOTP(): string {
	return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Generate a secure reset token
 * @returns UUID string
 */
export function generateResetToken(): string {
	return crypto.randomUUID();
}

export { getMail };
