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

export type PasswordRule = {
	id: 'length' | 'uppercase' | 'lowercase' | 'number' | 'special';
	label: string;
	met: boolean;
};

/**
 * Per-rule pass/fail, for a live checklist as the user types.
 *
 * Exists because the clients used to guess at the rules — signup checked `length < 6` and
 * the reset form `length < 8`, while the server has always required 8 characters plus four
 * character classes. A password the form accepted was then rejected by the API, which read
 * as a broken submit. Deriving the checklist from PASSWORD_REQUIREMENTS keeps the two ends
 * from drifting again.
 */
export function evaluatePassword(password: string): PasswordRule[] {
	return [
		{
			id: 'length',
			label: `At least ${PASSWORD_REQUIREMENTS.minLength} characters`,
			met: password.length >= PASSWORD_REQUIREMENTS.minLength,
		},
		{ id: 'uppercase', label: 'One uppercase letter', met: /[A-Z]/.test(password) },
		{ id: 'lowercase', label: 'One lowercase letter', met: /[a-z]/.test(password) },
		{ id: 'number', label: 'One number', met: /[0-9]/.test(password) },
		{ id: 'special', label: 'One special character', met: /[^A-Za-z0-9]/.test(password) },
	];
}

/** True when every rule in the live checklist passes. Mirrors `validatePassword().isValid`. */
export function isPasswordAcceptable(password: string): boolean {
	return evaluatePassword(password).every(rule => rule.met);
}

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
