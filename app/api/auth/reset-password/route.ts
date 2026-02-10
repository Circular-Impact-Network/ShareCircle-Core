import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { checkRateLimit, getClientIdentifier, rateLimitResponse } from '@/lib/rate-limit';
import { validatePassword, getPasswordRequirementsText } from '@/lib/password-validation';

export async function POST(req: NextRequest) {
	try {
		// Rate limiting
		const identifier = getClientIdentifier(req);
		const rateLimitResult = checkRateLimit(identifier, 'auth-reset-password', {
			maxRequests: 10,
			windowSeconds: 3600, // 1 hour window
		});
		if (!rateLimitResult.success) {
			return rateLimitResponse(rateLimitResult);
		}

		const body = await req.json();
		const { token, password } = body;

		if (!token || !password) {
			return NextResponse.json(
				{ error: 'Token and new password are required' },
				{ status: 400 }
			);
		}

		// Validate password strength
		const passwordValidation = validatePassword(password);
		if (!passwordValidation.isValid) {
			return NextResponse.json(
				{ 
					error: passwordValidation.errors[0],
					details: passwordValidation.errors,
					requirements: getPasswordRequirementsText(),
				},
				{ status: 400 }
			);
		}

		// Find the verification token
		const verificationToken = await prisma.verificationToken.findFirst({
			where: {
				token,
				identifier: { startsWith: 'reset:' },
			},
		});

		if (!verificationToken) {
			return NextResponse.json(
				{ error: 'Invalid or expired reset link. Please request a new one.' },
				{ status: 400 }
			);
		}

		// Check if token has expired
		if (new Date() > verificationToken.expires) {
			// Delete expired token
			await prisma.verificationToken.delete({
				where: {
					identifier_token: {
						identifier: verificationToken.identifier,
						token: verificationToken.token,
					},
				},
			});

			return NextResponse.json(
				{ error: 'Reset link has expired. Please request a new one.' },
				{ status: 400 }
			);
		}

		// Extract email from identifier (format: "reset:email@example.com")
		const email = verificationToken.identifier.replace('reset:', '');

		// Find user
		const user = await prisma.user.findUnique({
			where: { email },
		});

		if (!user) {
			return NextResponse.json(
				{ error: 'User not found' },
				{ status: 404 }
			);
		}

		// Hash new password
		const hashedPassword = await bcrypt.hash(password, 12);

		// Update user's password
		await prisma.user.update({
			where: { id: user.id },
			data: { 
				hashed_password: hashedPassword,
				// Also verify email if not already verified (since they received the email)
				emailVerified: user.emailVerified || new Date(),
			},
		});

		// Delete the used token
		await prisma.verificationToken.delete({
			where: {
				identifier_token: {
					identifier: verificationToken.identifier,
					token: verificationToken.token,
				},
			},
		});

		return NextResponse.json(
			{ message: 'Password reset successfully. You can now log in with your new password.' },
			{ status: 200 }
		);
	} catch (error) {
		console.error('Reset password error:', error);
		return NextResponse.json(
			{ error: 'An error occurred. Please try again.' },
			{ status: 500 }
		);
	}
}
