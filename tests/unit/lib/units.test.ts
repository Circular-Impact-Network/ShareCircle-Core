import { describe, expect, it } from 'vitest';
import { formatWeight, defaultWeightUnit, isApparelOrShoes } from '@/lib/units';

// Weight is stored in kg; these helpers drive the display-only kg/lbs toggle on item detail.
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
});

describe('defaultWeightUnit', () => {
	it('returns lbs for the US (case-insensitive)', () => {
		expect(defaultWeightUnit('US')).toBe('lbs');
		expect(defaultWeightUnit('us')).toBe('lbs');
	});

	it('returns kg for everything else and for missing country', () => {
		expect(defaultWeightUnit('IN')).toBe('kg');
		expect(defaultWeightUnit('GB')).toBe('kg');
		expect(defaultWeightUnit(null)).toBe('kg');
		expect(defaultWeightUnit(undefined)).toBe('kg');
		expect(defaultWeightUnit('')).toBe('kg');
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
