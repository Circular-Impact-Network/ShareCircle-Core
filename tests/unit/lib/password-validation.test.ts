/**
 * Unit tests for password validation
 */

import { describe, it, expect } from 'vitest';
import { validatePassword, getPasswordRequirementsText, PASSWORD_REQUIREMENTS } from '@/lib/password-validation';

describe('Password Validation', () => {
	describe('validatePassword', () => {
		it('accepts valid passwords', () => {
			const result = validatePassword('Password123!');
			expect(result.isValid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('rejects passwords shorter than 8 characters', () => {
			const result = validatePassword('Pass1!');
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Password must be at least 8 characters long');
		});

		it('rejects passwords without uppercase letters', () => {
			const result = validatePassword('password123!');
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Password must contain at least one uppercase letter');
		});

		it('rejects passwords without lowercase letters', () => {
			const result = validatePassword('PASSWORD123!');
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Password must contain at least one lowercase letter');
		});

		it('rejects passwords without numbers', () => {
			const result = validatePassword('Password!');
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Password must contain at least one number');
		});

		it('rejects passwords without special characters', () => {
			const result = validatePassword('Password123');
			expect(result.isValid).toBe(false);
			expect(result.errors).toContain('Password must contain at least one special character');
		});

		it('returns multiple errors for passwords missing multiple requirements', () => {
			const result = validatePassword('pass');
			expect(result.isValid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(1);
		});

		it('accepts passwords with various special characters', () => {
			const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '+', '='];
			specialChars.forEach(char => {
				const password = `Password1${char}`;
				const result = validatePassword(password);
				expect(result.isValid).toBe(true);
			});
		});

		it('handles edge case: exactly 8 characters with all requirements', () => {
			const result = validatePassword('Pass1!@#');
			expect(result.isValid).toBe(true);
		});
	});

	describe('getPasswordRequirementsText', () => {
		it('returns a descriptive text about password requirements', () => {
			const text = getPasswordRequirementsText();
			expect(text).toContain('8');
			expect(text).toContain('uppercase');
			expect(text).toContain('lowercase');
			expect(text).toContain('number');
			expect(text).toContain('special character');
		});
	});

	describe('PASSWORD_REQUIREMENTS', () => {
		it('exports correct requirements configuration', () => {
			expect(PASSWORD_REQUIREMENTS.minLength).toBe(8);
			expect(PASSWORD_REQUIREMENTS.requireUppercase).toBe(true);
			expect(PASSWORD_REQUIREMENTS.requireLowercase).toBe(true);
			expect(PASSWORD_REQUIREMENTS.requireNumber).toBe(true);
			expect(PASSWORD_REQUIREMENTS.requireSpecial).toBe(true);
		});
	});
});
