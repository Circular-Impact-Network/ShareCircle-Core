import { describe, expect, it } from 'vitest';
import {
	CURRENCIES,
	FALLBACK_RATES,
	convertFromUsd,
	formatMoney,
	getCurrency,
	isCurrencyCode,
	type FxRates,
} from '@/lib/currency';

// Money is stored in USD; these helpers only convert for display. The important property is
// that a bad or missing rate can never surface as NaN/0 in the UI.
describe('convertFromUsd', () => {
	it('returns the amount unchanged for USD', () => {
		expect(convertFromUsd(100, 'USD', FALLBACK_RATES)).toBe(100);
	});

	it('applies the supplied rate', () => {
		const rates = { ...FALLBACK_RATES, EUR: 0.5 };
		expect(convertFromUsd(100, 'EUR', rates)).toBe(50);
	});

	it('falls back to the bundled rate when the supplied rate is unusable', () => {
		// A live FX response missing a currency, or returning 0 / NaN / a negative, must not
		// wipe the displayed price out to zero.
		for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, undefined]) {
			const rates = { ...FALLBACK_RATES, INR: bad as number } as FxRates;
			expect(convertFromUsd(10, 'INR', rates)).toBeCloseTo(10 * FALLBACK_RATES.INR, 5);
		}
	});
});

describe('formatMoney', () => {
	it('renders a currency-formatted string with no fractional part', () => {
		// Rough retail estimates — cents are noise.
		const formatted = formatMoney(1234.56, 'USD', FALLBACK_RATES);
		expect(formatted).toContain('1,235');
		expect(formatted).not.toContain('.5');
	});

	it('converts before formatting', () => {
		const rates = { ...FALLBACK_RATES, EUR: 2 };
		expect(formatMoney(10, 'EUR', rates)).toMatch(/20/);
	});

	it('returns a dash for missing or non-finite amounts rather than "NaN"', () => {
		expect(formatMoney(null, 'USD', FALLBACK_RATES)).toBe('—');
		expect(formatMoney(undefined, 'USD', FALLBACK_RATES)).toBe('—');
		expect(formatMoney(Number.NaN, 'USD', FALLBACK_RATES)).toBe('—');
	});

	it('renders zero as an amount, not as missing', () => {
		expect(formatMoney(0, 'USD', FALLBACK_RATES)).toMatch(/0/);
	});

	it('produces a distinct output for every supported currency', () => {
		const rendered = CURRENCIES.map(c => formatMoney(100, c.code, FALLBACK_RATES));
		expect(new Set(rendered).size).toBe(CURRENCIES.length);
	});
});

describe('currency metadata', () => {
	it('has a fallback rate for every supported currency, with USD pinned at 1', () => {
		// convertFromUsd's last-resort path indexes FALLBACK_RATES, so a gap here would
		// reintroduce the NaN it exists to prevent.
		for (const { code } of CURRENCIES) {
			expect(FALLBACK_RATES[code]).toBeGreaterThan(0);
		}
		expect(FALLBACK_RATES.USD).toBe(1);
	});

	it('validates currency codes', () => {
		expect(isCurrencyCode('EUR')).toBe(true);
		expect(isCurrencyCode('ZZZ')).toBe(false);
		expect(isCurrencyCode(null)).toBe(false);
		expect(isCurrencyCode(42)).toBe(false);
	});

	it('falls back to the first currency for an unknown code', () => {
		expect(getCurrency('NOPE' as never).code).toBe(CURRENCIES[0].code);
	});
});
