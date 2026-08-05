import { NextResponse } from 'next/server';

import { CURRENCIES, FALLBACK_RATES, type FxRates } from '@/lib/currency';

/**
 * USD-based FX rates for price display.
 *
 * Fetched server-side (so the browser never talks to a third-party host and CSP stays
 * `connect-src 'self'`) from Frankfurter, which serves ECB reference rates and needs no
 * API key. Cached for 24h — these are used to render rough retail estimates, not to
 * settle payments.
 *
 * Never fails: on any upstream problem it returns the bundled fallback table with
 * `stale: true` so the client can render a number regardless.
 */

const CACHE_SECONDS = 60 * 60 * 24;

const TARGET_CURRENCIES = CURRENCIES.map(c => c.code).filter(code => code !== 'USD');

export async function GET() {
	try {
		const res = await fetch(
			`https://api.frankfurter.dev/v1/latest?base=USD&symbols=${TARGET_CURRENCIES.join(',')}`,
			{
				next: { revalidate: CACHE_SECONDS },
				signal: AbortSignal.timeout(5000),
			},
		);

		if (!res.ok) {
			throw new Error(`FX upstream responded ${res.status}`);
		}

		const data = (await res.json()) as { rates?: Record<string, number> };
		if (!data.rates) {
			throw new Error('FX upstream returned no rates');
		}

		// Start from the fallback table so a currency the upstream omits still has a rate,
		// and USD is always exactly 1.
		const rates: FxRates = { ...FALLBACK_RATES };
		for (const code of TARGET_CURRENCIES) {
			const rate = data.rates[code];
			if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
				rates[code] = rate;
			}
		}
		rates.USD = 1;

		return NextResponse.json(
			{ rates, stale: false },
			{
				headers: {
					'Cache-Control': `public, max-age=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
				},
			},
		);
	} catch (error) {
		console.error('FX rate fetch failed, serving fallback rates:', error);
		return NextResponse.json({ rates: FALLBACK_RATES, stale: true });
	}
}
