import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from '@/lib/rate-limit';
import { validatePassword, getPasswordRequirementsText } from '@/lib/password-validation';

/**
 * Authenticated password change: verify the current password, then set a new one.
 * This is intentionally independent of the email-OTP / emailVerified pipeline so a
 * logged-in user can change their password without an email round-trip. The email-OTP
 * flow remains available as the "forgot password" fallback.
 */
export async function POST(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const identifier = getClientIdentifier(req);
		const rateLimitResult = checkRateLimit(identifier, 'auth-change-password', {
			maxRequests: 10,
			windowSeconds: 3600,
		});
		if (!rateLimitResult.success) {
			return rateLimitResponse(rateLimitResult);
		}

		const { currentPassword, newPassword } = (await req.json()) as {
			currentPassword?: string;
			newPassword?: string;
		};

		if (!currentPassword || !newPassword) {
			return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 });
		}

		const user = await prisma.user.findUnique({ where: { id: session.user.id } });
		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		// Social-only accounts (Google) have no password to compare against.
		if (!user.hashed_password) {
			return NextResponse.json(
				{ error: 'Your account uses social login. Set a password via "Forgot password" first.' },
				{ status: 400 },
			);
		}

		const currentMatches = await bcrypt.compare(currentPassword, user.hashed_password);
		if (!currentMatches) {
			return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
		}

		const passwordValidation = validatePassword(newPassword);
		if (!passwordValidation.isValid) {
			return NextResponse.json(
				{
					error: passwordValidation.errors[0],
					details: passwordValidation.errors,
					requirements: getPasswordRequirementsText(),
				},
				{ status: 400 },
			);
		}

		// Reject a no-op change so users don't think they rotated a compromised password.
		const sameAsOld = await bcrypt.compare(newPassword, user.hashed_password);
		if (sameAsOld) {
			return NextResponse.json(
				{ error: 'New password must be different from your current password' },
				{ status: 400 },
			);
		}

		const hashedPassword = await bcrypt.hash(newPassword, 12);
		await prisma.user.update({
			where: { id: user.id },
			data: { hashed_password: hashedPassword },
		});

		return NextResponse.json({ message: 'Password changed successfully.' }, { status: 200 });
	} catch (error) {
		console.error('Change password error:', error);
		return NextResponse.json({ error: 'An error occurred. Please try again.' }, { status: 500 });
	}
}
