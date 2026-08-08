export type WeightUnit = 'kg' | 'lbs';

const KG_TO_LBS = 2.20462;

/**
 * Mass is always stored in kilograms; this renders it in the unit the user chose.
 *
 * Used for item weight AND for CO₂ figures. They are the same operation, so they get the same
 * function — a second near-identical formatter is how the two drift apart later. Thousands are
 * separated because impact totals reach four and five digits, where an unseparated run of digits
 * is genuinely hard to read.
 */
export function formatWeight(kg: number, unit: WeightUnit): string {
	const value = unit === 'lbs' ? kg * KG_TO_LBS : kg;
	return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}`;
}

/**
 * A display value typed by the user, converted to the kilograms we store.
 *
 * Inputs previously hard-coded "Weight (kg)", so a user set to pounds typed a pound number into a
 * kilogram field and the item was stored at roughly 2.2x its real weight.
 */
export function toKg(value: number, unit: WeightUnit): number {
	return unit === 'lbs' ? value / KG_TO_LBS : value;
}

/** Stored kilograms as a bare number in the user's unit, for pre-filling an input. */
export function fromKg(kg: number, unit: WeightUnit): number {
	const value = unit === 'lbs' ? kg * KG_TO_LBS : kg;
	// Two decimals: enough that a round-trip through the field does not visibly drift, without
	// showing a user the float noise of the division.
	return Math.round(value * 100) / 100;
}

const APPAREL_CATEGORY_RE = /apparel|clothing|shoe|footwear|dress|shirt|pant|jacket|garment|accessor|apparel/i;

/** Apparel/shoes items get a "check with owner for size" note since size isn't captured. */
export function isApparelOrShoes(categories: string[] | undefined | null): boolean {
	return Boolean(categories?.some(c => APPAREL_CATEGORY_RE.test(c)));
}
