import { randomInt } from 'crypto';
import { Resend } from 'resend';
import type { OtpPurpose } from './otp';

const BRAND = {
	name: 'ShareCircle',
	tagline: 'Share more. Buy less.',
	primary: '#34a85a',
	ink: '#111827',
	muted: '#6b7280',
	faint: '#9ca3af',
	panel: '#ffffff',
	background: '#f3f6f4',
	border: '#e5e7eb',
	subtle: '#f9fafb',
};

const FONT_STACK = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;

/**
 * Absolute base URL for images referenced by emails. Mail clients cannot resolve relative
 * paths, and a `data:` URI is stripped by Gmail and Outlook, so a remotely-hosted asset on
 * our own origin is the only option that renders.
 *
 * Derived from NEXTAUTH_URL because NextAuth already requires it to be the public origin in
 * production. `EMAIL_ASSET_BASE_URL` overrides it when mail should point at a different host
 * (e.g. a CDN, or a staging deploy sending on behalf of production).
 */
function getAssetBaseUrl(): string | null {
	const raw = (process.env.EMAIL_ASSET_BASE_URL || process.env.NEXTAUTH_URL || '').trim().replace(/\/+$/, '');
	if (!raw) {
		return null;
	}
	// A localhost URL is unreachable from the recipient's mail client and renders as a broken
	// image icon, which looks worse than the wordmark alone. Fall back to text in development.
	if (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(raw)) {
		return null;
	}
	return raw;
}

/**
 * Brand lockup. Uses the real logo when we have a publicly reachable origin, and always
 * renders the wordmark as text beside it — most clients block remote images by default, so
 * an image-only header would show an empty box on first open.
 */
function renderBrandHeader(): string {
	const base = getAssetBaseUrl();
	const logoCell = base
		? `<td style="padding-right:10px; vertical-align:middle;">
				<img src="${base}/email/logo.png" width="36" height="36" alt=""
					style="display:block; width:36px; height:36px; border:0; outline:none; text-decoration:none;" />
			</td>`
		: '';

	return `
		<tr>
			<td align="center" style="padding:0 0 28px 0;">
				<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
					<tr>
						${logoCell}
						<td style="vertical-align:middle; font-family:${FONT_STACK};">
							<div style="font-size:19px; font-weight:700; letter-spacing:-0.2px; color:${BRAND.ink}; line-height:1.2;">${BRAND.name}</div>
							<div style="font-size:11px; color:${BRAND.faint}; line-height:1.4;">${BRAND.tagline}</div>
						</td>
					</tr>
				</table>
			</td>
		</tr>
	`;
}

/**
 * Table-based email shell.
 *
 * Everything is a nested table with inline styles on purpose: Outlook's Word rendering engine
 * ignores flexbox and most box-model CSS, so the previous `display:inline-flex` header
 * collapsed into stacked text there. `width` attributes sit alongside the CSS widths for the
 * same reason.
 */
function wrapEmailHtml(options: { title: string; preview: string; content: string; showIgnoreNotice?: boolean }) {
	const { title, preview, content, showIgnoreNotice = true } = options;

	return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
	<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<meta name="color-scheme" content="light only" />
	<meta name="supported-color-schemes" content="light only" />
	<title>${title}</title>
</head>
<body style="margin:0; padding:0; width:100%; background-color:${BRAND.background}; font-family:${FONT_STACK}; color:${BRAND.ink}; -webkit-font-smoothing:antialiased;">
	<div style="display:none; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all;">${preview}</div>
	<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${BRAND.background};">
		<tr>
			<td align="center" style="padding:32px 16px;">
				<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:100%; max-width:560px; background-color:${BRAND.panel}; border:1px solid ${BRAND.border}; border-radius:14px;">
					<tr>
						<td style="padding:32px 32px 28px 32px;">
							<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
								${renderBrandHeader()}
								${content}
							</table>
						</td>
					</tr>
					${
						showIgnoreNotice
							? `<tr>
						<td style="padding:0 32px 28px 32px;">
							<div style="border-top:1px solid ${BRAND.border}; padding-top:18px; font-size:12px; line-height:1.6; color:${BRAND.muted}; text-align:center;">
								Didn&rsquo;t request this? You can safely ignore this email &mdash; nothing will change on your account.
							</div>
						</td>
					</tr>`
							: ''
					}
				</table>
				<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:100%; max-width:560px;">
					<tr>
						<td align="center" style="padding:20px 8px 0 8px; font-size:11px; line-height:1.6; color:${BRAND.faint};">
							&copy; ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.<br />
							This is an automated message, so please don&rsquo;t reply to it.
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>`;
}

/**
 * Transactional email via Resend.
 *
 * Replaced SMTP-over-Gmail (irismail): Gmail's SMTP handshake regularly failed on the first
 * send after a cold serverless start, which is why first verification codes so often never
 * arrived. Resend is an HTTP API — no handshake, no connection reuse problem — and sends from
 * a verified domain, so messages are far less likely to be filtered as spam.
 */

export const EMAIL_FROM = process.env.EMAIL_FROM || 'ShareCircle <no-reply@circularimpact.org>';

let resendInstance: Resend | null = null;

/** True when emails should be logged instead of sent. Development/test only, by design. */
function isEmailSuppressed(): boolean {
	// SKIP_EMAIL used to be ungated, so setting it in production silently swallowed every OTP
	// while the signup API still reported emailSent: true — users waited forever on a code
	// that was never sent. A misconfigured production host must fail loudly, not quietly.
	if (process.env.NODE_ENV !== 'production') {
		return process.env.E2E_AUTO_VERIFY === 'true' || process.env.SKIP_EMAIL === 'true';
	}
	if (process.env.SKIP_EMAIL === 'true') {
		console.error('SKIP_EMAIL is set in production and is being ignored — emails will be sent normally.');
	}
	return false;
}

function getResend(): Resend | null {
	if (isEmailSuppressed()) {
		return null;
	}
	if (resendInstance) {
		return resendInstance;
	}
	const apiKey = process.env.RESEND_API_KEY;
	if (!apiKey) {
		console.error('RESEND_API_KEY is not set — transactional emails cannot be sent.');
		return null;
	}
	resendInstance = new Resend(apiKey);
	return resendInstance;
}

/** True when the app is configured to actually deliver email. */
export function isEmailConfigured(): boolean {
	return Boolean(process.env.RESEND_API_KEY) && !isEmailSuppressed();
}

/**
 * Sends one email, throwing on failure so callers can report an honest emailSent: false.
 *
 * Resend returns errors in the response body rather than rejecting, so the `error` field
 * must be checked explicitly — otherwise a rejected send looks like a success.
 */
async function sendEmail(options: {
	to: string;
	subject: string;
	html: string;
	/** Plain-text alternative. HTML-only mail scores worse with spam filters. */
	text: string;
	label: string;
}): Promise<void> {
	const client = getResend();
	if (!client) {
		console.log(`[Dev/Test] Skipping ${options.label} to ${options.to}`);
		return;
	}

	const { error } = await client.emails.send({
		from: EMAIL_FROM,
		to: options.to,
		subject: options.subject,
		html: options.html,
		text: options.text,
	});

	if (error) {
		throw new Error(`Resend failed to send ${options.label}: ${error.name} — ${error.message}`);
	}
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

	const html = wrapEmailHtml({
		title,
		preview,
		content: `
			<tr>
				<td align="center" style="padding-bottom:10px;">
					<h1 style="margin:0; font-size:22px; line-height:1.3; font-weight:700; letter-spacing:-0.3px; color:${BRAND.ink};">${title}</h1>
				</td>
			</tr>
			<tr>
				<td align="center" style="padding-bottom:26px; font-size:14px; line-height:1.6; color:${BRAND.muted};">
					${message}
				</td>
			</tr>
			<tr>
				<td align="center">
					<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
						<tr>
							<td align="center" style="background-color:${BRAND.subtle}; border:1px solid ${BRAND.border}; border-radius:12px; padding:20px 28px;">
								<span style="font-family:'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size:30px; line-height:1.1; letter-spacing:9px; font-weight:700; color:${BRAND.primary};">${otp}</span>
							</td>
						</tr>
					</table>
				</td>
			</tr>
			<tr>
				<td align="center" style="padding-top:14px; font-size:12px; line-height:1.6; color:${BRAND.muted};">
					This code expires in 10 minutes. Don&rsquo;t share it with anyone.
				</td>
			</tr>
		`,
	});

	const text = [
		`${BRAND.name} — ${title}`,
		'',
		message,
		'',
		`Your code: ${otp}`,
		'',
		"This code expires in 10 minutes. Don't share it with anyone.",
		"Didn't request this? You can safely ignore this email.",
	].join('\n');

	if (!isEmailConfigured()) {
		console.log(`[Dev/Test] Skipping OTP email to ${to} (OTP: ${otp})`);
		return;
	}

	// One retry, for a transient network blip reaching the API. The SMTP-handshake failure
	// this originally guarded against no longer applies now that sending is over HTTP.
	try {
		await sendEmail({ to, subject, html, text, label: 'OTP email' });
	} catch (err) {
		console.error(`OTP email first attempt failed for ${to}, retrying:`, err);
		await sendEmail({ to, subject, html, text, label: 'OTP email' });
	}
}

/**
 * Send password reset email
 * @param to - Recipient email address
 * @param resetToken - Unique reset token
 * @returns Promise that resolves when email is sent
 */
export async function sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
	const resetUrl = `${process.env.NEXTAUTH_URL}/login?mode=reset&token=${resetToken}`;

	const html = wrapEmailHtml({
		title: 'Reset your password',
		preview: 'Use this link to reset your ShareCircle password.',
		content: `
			<tr>
				<td align="center" style="padding-bottom:10px;">
					<h1 style="margin:0; font-size:22px; line-height:1.3; font-weight:700; letter-spacing:-0.3px; color:${BRAND.ink};">Reset your password</h1>
				</td>
			</tr>
			<tr>
				<td align="center" style="padding-bottom:26px; font-size:14px; line-height:1.6; color:${BRAND.muted};">
					Tap the button below to choose a new password. This link expires in 1 hour.
				</td>
			</tr>
			<tr>
				<td align="center" style="padding-bottom:24px;">
					<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
						<tr>
							<td align="center" style="background-color:${BRAND.primary}; border-radius:10px;">
								<a href="${resetUrl}" style="display:inline-block; padding:13px 30px; font-family:${FONT_STACK}; font-size:15px; font-weight:600; line-height:1; color:#ffffff; text-decoration:none;">
									Reset password
								</a>
							</td>
						</tr>
					</table>
				</td>
			</tr>
			<tr>
				<td align="center" style="font-size:12px; line-height:1.6; color:${BRAND.muted};">
					If the button doesn&rsquo;t work, copy this link into your browser:<br />
					<a href="${resetUrl}" style="color:${BRAND.primary}; word-break:break-all; text-decoration:underline;">${resetUrl}</a>
				</td>
			</tr>
		`,
	});

	await sendEmail({
		to,
		subject: 'Reset your password - ShareCircle',
		html,
		text: [
			`${BRAND.name} — Reset your password`,
			'',
			'Open this link to choose a new password. It expires in 1 hour.',
			'',
			resetUrl,
			'',
			"Didn't request this? You can safely ignore this email.",
		].join('\n'),
		label: 'password reset email',
	});
}

/**
 * Generate a 6-digit OTP code
 * @returns 6-digit string
 */
export function generateOTP(): string {
	return randomInt(100000, 1000000).toString();
}

/**
 * Generate a secure reset token
 * @returns UUID string
 */
export function generateResetToken(): string {
	return crypto.randomUUID();
}
