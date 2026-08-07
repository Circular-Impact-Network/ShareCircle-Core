export type WeightUnit = 'kg' | 'lbs';

const KG_TO_LBS = 2.20462;

/** Weight is always stored in kg; this converts for display only. */
export function formatWeight(kg: number, unit: WeightUnit): string {
	if (unit === 'lbs') {
		return `${Math.round(kg * KG_TO_LBS * 10) / 10} lbs`;
	}
	return `${kg} kg`;
}

const APPAREL_CATEGORY_RE = /apparel|clothing|shoe|footwear|dress|shirt|pant|jacket|garment|accessor|apparel/i;

/** Apparel/shoes items get a "check with owner for size" note since size isn't captured. */
export function isApparelOrShoes(categories: string[] | undefined | null): boolean {
	return Boolean(categories?.some(c => APPAREL_CATEGORY_RE.test(c)));
}
