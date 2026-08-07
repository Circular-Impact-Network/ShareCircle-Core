/**
 * Client display preferences: theme, font size, weight unit, currency.
 *
 * These live in localStorage rather than the DB — they are per-device presentation
 * choices, they must apply before first paint (a DB round trip cannot), and this mirrors
 * how theme already worked. Pure helpers live here so they can be unit tested without a
 * DOM; the React wiring is in `app/providers.tsx`.
 */

import { DEFAULT_CURRENCY, isCurrencyCode, type CurrencyCode } from '@/lib/currency';
import type { WeightUnit } from '@/lib/units';

export const PREFERENCE_STORAGE_KEYS = {
	theme: 'sharecircle_theme',
	fontSize: 'sharecircle_font_size',
	weightUnit: 'sharecircle_weight_unit',
	currency: 'sharecircle_currency',
} as const;

export type FontSizeKey = 'sm' | 'md' | 'lg';

export type FontSizeDefinition = {
	key: FontSizeKey;
	label: string;
	/**
	 * Root font size. Tailwind emits rem, so this scales every text-* and spacing
	 * utility in the app proportionally.
	 */
	px: number;
};

export const FONT_SIZES: FontSizeDefinition[] = [
	{ key: 'sm', label: 'Small', px: 14 },
	{ key: 'md', label: 'Default', px: 16 },
	{ key: 'lg', label: 'Large', px: 18 },
];

export const DEFAULT_FONT_SIZE: FontSizeKey = 'md';
export const DEFAULT_WEIGHT_UNIT: WeightUnit = 'kg';

export function isFontSizeKey(value: unknown): value is FontSizeKey {
	return value === 'sm' || value === 'md' || value === 'lg';
}

export function isWeightUnit(value: unknown): value is WeightUnit {
	return value === 'kg' || value === 'lbs';
}

export function fontSizePx(key: FontSizeKey): number {
	return (FONT_SIZES.find(f => f.key === key) ?? FONT_SIZES[1]).px;
}

/** Narrows an unknown localStorage value to a valid key, falling back to the default. */
export function coerceFontSize(value: unknown): FontSizeKey {
	return isFontSizeKey(value) ? value : DEFAULT_FONT_SIZE;
}

export function coerceWeightUnit(value: unknown): WeightUnit {
	return isWeightUnit(value) ? value : DEFAULT_WEIGHT_UNIT;
}

export function coerceCurrency(value: unknown): CurrencyCode {
	return isCurrencyCode(value) ? value : DEFAULT_CURRENCY;
}

/**
 * Applies the root font size. Kept here (rather than inline in the provider) so the
 * pre-paint script in app/layout.tsx and the React provider stay in agreement.
 */
export function applyFontSize(key: FontSizeKey): void {
	if (typeof document === 'undefined') {
		return;
	}
	document.documentElement.style.fontSize = `${fontSizePx(key)}px`;
}
