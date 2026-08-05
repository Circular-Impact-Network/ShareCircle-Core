/**
 * Unit tests for password validation
 */

import { describe, it, expect } from 'vitest';
import {
	validatePassword,
	getPasswordRequirementsText,
	PASSWORD_REQUIREMENTS,
	evaluatePassword,
	isPasswordAcceptable,
} from '@/lib/password-validation';

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

	// Backs the live as-you-type checklist added 2026-08-05.
	describe('evaluatePassword', () => {
		const met = (password: string) =>
			Object.fromEntries(evaluatePassword(password).map(rule => [rule.id, rule.met]));

		it('reports one entry per requirement, in a stable order', () => {
			expect(evaluatePassword('').map(rule => rule.id)).toEqual([
				'length',
				'uppercase',
				'lowercase',
				'number',
				'special',
			]);
		});

		it('marks nothing met for an empty password', () => {
			expect(Object.values(met(''))).toEqual([false, false, false, false, false]);
		});

		it('marks each rule independently as characters are added', () => {
			expect(met('abc')).toMatchObject({ length: false, lowercase: true, uppercase: false });
			expect(met('Abc')).toMatchObject({ lowercase: true, uppercase: true, number: false });
			expect(met('Abc12345')).toMatchObject({ length: true, number: true, special: false });
			expect(met('Abc1234!')).toMatchObject({
				length: true,
				uppercase: true,
				lowercase: true,
				number: true,
				special: true,
			});
		});

		it('derives the length rule from PASSWORD_REQUIREMENTS rather than a literal', () => {
			const justShort = 'Aa1!'.padEnd(PASSWORD_REQUIREMENTS.minLength - 1, 'x');
			const exact = 'Aa1!'.padEnd(PASSWORD_REQUIREMENTS.minLength, 'x');
			expect(met(justShort).length).toBe(false);
			expect(met(exact).length).toBe(true);
		});

		it('counts a space as a special character', () => {
			expect(met('Abc 1234').special).toBe(true);
		});
	});

	describe('isPasswordAcceptable', () => {
		/**
		 * The contract that matters: the clients gate on isPasswordAcceptable while the API
		 * gates on validatePassword. If these ever disagree, a password passes the form and is
		 * rejected by the server — the 2026-08-05 bug, where signup checked `length < 6`.
		 */
		it.each([
			'',
			'abc123',
			'password',
			'PASSWORD123!',
			'password123!',
			'Password!',
			'Password123',
			'Pass1!',
			'Password123!',
			'Abc 1234',
			'aB3$aB3$',
		])('agrees with validatePassword for %j', password => {
			expect(isPasswordAcceptable(password)).toBe(validatePassword(password).isValid);
		});
	});
});
