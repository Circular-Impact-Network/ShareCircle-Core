import { describe, expect, it } from 'vitest';
import {
	DEFAULT_FONT_SIZE,
	FONT_SIZES,
	PREFERENCE_STORAGE_KEYS,
	coerceCurrency,
	coerceFontSize,
	coerceWeightUnit,
	fontSizePx,
	isFontSizeKey,
	isWeightUnit,
} from '@/lib/preferences';

// These preferences come out of localStorage, which can hold anything a previous version (or
// a user poking at devtools) left behind. Coercion must never propagate a bad value into the
// DOM as a font-size or into price formatting as a currency.
describe('preference coercion', () => {
	it('accepts valid values unchanged', () => {
		expect(coerceFontSize('lg')).toBe('lg');
		expect(coerceWeightUnit('lbs')).toBe('lbs');
		expect(coerceCurrency('INR')).toBe('INR');
	});

	it('falls back to defaults for junk', () => {
		for (const junk of [null, undefined, '', 'huge', 42, {}, []]) {
			expect(coerceFontSize(junk)).toBe(DEFAULT_FONT_SIZE);
			expect(coerceWeightUnit(junk)).toBe('kg');
			expect(coerceCurrency(junk)).toBe('USD');
		}
	});

	it('validates keys', () => {
		expect(isFontSizeKey('sm')).toBe(true);
		expect(isFontSizeKey('xl')).toBe(false);
		expect(isWeightUnit('kg')).toBe(true);
		expect(isWeightUnit('stone')).toBe(false);
	});
});

describe('font sizes', () => {
	it('exposes three ascending steps with Default at 16px', () => {
		// 16px must be the middle step: it is the browser default, so "Default" has to be a
		// no-op rather than a resize.
		expect(FONT_SIZES.map(f => f.key)).toEqual(['sm', 'md', 'lg']);
		expect(fontSizePx('md')).toBe(16);
		expect(fontSizePx('sm')).toBeLessThan(fontSizePx('md'));
		expect(fontSizePx('lg')).toBeGreaterThan(fontSizePx('md'));
	});

	it('resolves an unknown key to the middle step instead of throwing', () => {
		expect(fontSizePx('nope' as never)).toBe(16);
	});

	it('matches the size map inlined in the pre-paint script', () => {
		// app/layout.tsx hardcodes {sm:14,md:16,lg:18} to apply the size before first paint.
		// If these drift, the page renders at one size then jumps to another.
		expect(FONT_SIZES.map(f => f.px)).toEqual([14, 16, 18]);
	});
});

describe('storage keys', () => {
	it('are namespaced and stable', () => {
		// The pre-paint script reads these literal strings; renaming one silently disables
		// FOUC prevention for that preference.
		expect(PREFERENCE_STORAGE_KEYS.theme).toBe('sharecircle_theme');
		expect(PREFERENCE_STORAGE_KEYS.fontSize).toBe('sharecircle_font_size');
		expect(PREFERENCE_STORAGE_KEYS.weightUnit).toBe('sharecircle_weight_unit');
		expect(PREFERENCE_STORAGE_KEYS.currency).toBe('sharecircle_currency');
	});
});
