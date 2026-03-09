import { describe, expect, it } from 'vitest';
import { getDialCodeForCountry, normalizePhoneNumber, validatePhoneByCountry } from '@/lib/phone';

describe('phone utilities', () => {
	it('returns dial code for supported countries', () => {
		expect(getDialCodeForCountry('IN')).toBe('+91');
		expect(getDialCodeForCountry('US')).toBe('+1');
	});

	it('normalizes valid numbers to e164 format', () => {
		const normalized = normalizePhoneNumber('9876543210', 'IN');
		expect(normalized).not.toBeNull();
		expect(normalized?.e164.startsWith('+91')).toBe(true);
	});

	it('validates invalid numbers', () => {
		const result = validatePhoneByCountry('123', 'IN');
		expect(result.valid).toBe(false);
	});
});
