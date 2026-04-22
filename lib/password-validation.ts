import { z } from 'zod';

/**
 * Password requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */

export const PASSWORD_REQUIREMENTS = {
	minLength: 8,
	requireUppercase: true,
	requireLowercase: true,
	requireNumber: true,
	requireSpecial: true,
} as const;

export const passwordSchema = z
	.string()
	.min(
		PASSWORD_REQUIREMENTS.minLength,
		`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters long`,
	)
	.regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
	.regex(/[a-z]/, 'Password must contain at least one lowercase letter')
	.regex(/[0-9]/, 'Password must contain at least one number')
	.regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export type PasswordValidationResult = {
	isValid: boolean;
	errors: string[];
};

/**
 * Validate a password against the requirements.
 * Returns an object with isValid and an array of error messages.
 */
export function validatePassword(password: string): PasswordValidationResult {
	const result = passwordSchema.safeParse(password);

	if (result.success) {
		return { isValid: true, errors: [] };
	}

	return {
		isValid: false,
		errors: result.error.errors.map(e => e.message),
	};
}

/**
 * Get a human-readable description of password requirements.
 */
export function getPasswordRequirementsText(): string {
	return `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters and contain at least one uppercase letter, one lowercase letter, one number, and one special character.`;
}
