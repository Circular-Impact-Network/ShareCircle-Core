/**
 * Money is stored in USD (Item.estimatedNewPriceUsd, impact view totals). Conversion is a
 * display concern only — nothing is ever persisted in a non-USD currency.
 *
 * Rates come from `/api/fx` (ECB via Frankfurter, cached 24h server-side). If that is
 * unreachable the caller falls back to FALLBACK_RATES so the UI still renders a number
 * rather than breaking.
 */

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'INR' | 'CAD' | 'AUD';

export type CurrencyDefinition = {
	code: CurrencyCode;
	label: string;
	symbol: string;
	locale: string;
};

export const CURRENCIES: CurrencyDefinition[] = [
	{ code: 'USD', label: 'US Dollar', symbol: '$', locale: 'en-US' },
	{ code: 'EUR', label: 'Euro', symbol: '€', locale: 'de-DE' },
	{ code: 'GBP', label: 'British Pound', symbol: '£', locale: 'en-GB' },
	{ code: 'INR', label: 'Indian Rupee', symbol: '₹', locale: 'en-IN' },
	{ code: 'CAD', label: 'Canadian Dollar', symbol: 'CA$', locale: 'en-CA' },
	{ code: 'AUD', label: 'Australian Dollar', symbol: 'A$', locale: 'en-AU' },
];

export const DEFAULT_CURRENCY: CurrencyCode = 'USD';

const CURRENCY_CODES = new Set<string>(CURRENCIES.map(c => c.code));

export function isCurrencyCode(value: unknown): value is CurrencyCode {
	return typeof value === 'string' && CURRENCY_CODES.has(value);
}

export function getCurrency(code: CurrencyCode): CurrencyDefinition {
	return CURRENCIES.find(c => c.code === code) ?? CURRENCIES[0];
}

/** USD -> currency multipliers. Keys must cover every CurrencyCode. */
export type FxRates = Record<CurrencyCode, number>;

/**
 * Last-resort rates, used only when /api/fx cannot reach its upstream. Deliberately
 * approximate — they exist so a price still renders, not to be accurate. USD is 1 by
 * definition, so a USD-only user never depends on these.
 */
export const FALLBACK_RATES: FxRates = {
	USD: 1,
	EUR: 0.92,
	GBP: 0.79,
	INR: 83.5,
	CAD: 1.36,
	AUD: 1.52,
};

export function convertFromUsd(usd: number, currency: CurrencyCode, rates: FxRates = FALLBACK_RATES): number {
	const rate = rates[currency];
	// A missing or nonsensical rate must not silently produce NaN/0 — fall back to the
	// bundled table, and finally to USD (rate 1) so the number stays meaningful.
	const safeRate = typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : (FALLBACK_RATES[currency] ?? 1);
	return usd * safeRate;
}

/**
 * Formats a USD amount in the user's chosen currency. Whole units only — these are rough
 * retail estimates, so cents are noise.
 */
export function formatMoney(usd: number | null | undefined, currency: CurrencyCode, rates: FxRates = FALLBACK_RATES): string {
	if (usd === null || usd === undefined || !Number.isFinite(usd)) {
		return '—';
	}

	const { locale } = getCurrency(currency);
	const converted = convertFromUsd(usd, currency, rates);

	try {
		return new Intl.NumberFormat(locale, {
			style: 'currency',
			currency,
			maximumFractionDigits: 0,
		}).format(converted);
	} catch {
		// Intl can throw on an unknown currency/locale pair in older runtimes.
		return `${getCurrency(currency).symbol}${Math.round(converted).toLocaleString()}`;
	}
}
