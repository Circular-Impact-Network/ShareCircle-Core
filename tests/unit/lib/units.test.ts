import { describe, expect, it } from 'vitest';
import { formatWeight, fromKg, isApparelOrShoes, toKg } from '@/lib/units';

// Weight is stored in kg; formatWeight renders it in whichever unit the user picked in
// Settings → Appearance. (defaultWeightUnit was removed: it derived the unit from
// User.country_code, which holds a phone dial code, so its 'US' check never matched.)
describe('formatWeight', () => {
	it('renders kg unchanged', () => {
		expect(formatWeight(10, 'kg')).toBe('10 kg');
		expect(formatWeight(0, 'kg')).toBe('0 kg');
		expect(formatWeight(2.5, 'kg')).toBe('2.5 kg');
	});

	it('converts kg to lbs rounded to one decimal', () => {
		expect(formatWeight(10, 'lbs')).toBe('22 lbs'); // 22.0462 → 22
		expect(formatWeight(1, 'lbs')).toBe('2.2 lbs'); // 2.20462 → 2.2
		expect(formatWeight(0, 'lbs')).toBe('0 lbs');
	});

	// Impact totals reach four and five digits, and previously rendered as a raw digit run.
	it('separates thousands and caps noisy decimals', () => {
		expect(formatWeight(1234, 'kg')).toBe('1,234 kg');
		expect(formatWeight(12.3456789, 'kg')).toBe('12.3 kg');
	});
});

// Inputs used to be labelled "Weight (kg)" regardless of the chosen unit, so someone set to pounds
// typed a pound figure into a kilogram field and the item was stored ~2.2x too heavy.
describe('toKg / fromKg', () => {
	it('passes kilograms through untouched', () => {
		expect(toKg(10, 'kg')).toBe(10);
		expect(fromKg(10, 'kg')).toBe(10);
	});

	it('converts pounds in both directions', () => {
		expect(toKg(22.0462, 'lbs')).toBeCloseTo(10, 4);
		expect(fromKg(10, 'lbs')).toBeCloseTo(22.05, 2);
	});

	it('round-trips without visible drift', () => {
		for (const kg of [0.5, 1, 7.25, 40, 133.7]) {
			expect(toKg(fromKg(kg, 'lbs'), 'lbs')).toBeCloseTo(kg, 1);
		}
	});

	it('treats zero as zero rather than dividing into NaN', () => {
		expect(toKg(0, 'lbs')).toBe(0);
		expect(fromKg(0, 'lbs')).toBe(0);
	});
});

describe('isApparelOrShoes', () => {
	it('matches apparel / shoe categories (case-insensitive, substring)', () => {
		expect(isApparelOrShoes(['Clothing'])).toBe(true);
		expect(isApparelOrShoes(['Shoes'])).toBe(true);
		expect(isApparelOrShoes(['Footwear'])).toBe(true);
		expect(isApparelOrShoes(['Winter Jacket'])).toBe(true); // "jacket"
		expect(isApparelOrShoes(['Accessories'])).toBe(true); // "accessor"
		expect(isApparelOrShoes(['Electronics', 'Dresses'])).toBe(true); // any match
	});

	it('returns false for non-apparel categories and empty/missing input', () => {
		expect(isApparelOrShoes(['Electronics'])).toBe(false);
		expect(isApparelOrShoes(['Tools', 'Kitchen'])).toBe(false);
		expect(isApparelOrShoes([])).toBe(false);
		expect(isApparelOrShoes(undefined)).toBe(false);
		expect(isApparelOrShoes(null)).toBe(false);
	});
});
