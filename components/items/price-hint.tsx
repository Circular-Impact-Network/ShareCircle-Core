'use client';

import { formatMoney } from '@/lib/currency';
import { usePreferences } from '@/lib/preferences-context';

/**
 * Shows a USD price in the viewer's own currency, underneath a field that stays in USD.
 *
 * Prices are entered and stored in USD on purpose. Exchange rates move, so accepting another
 * currency would mean converting on the way in and again on the way out, and the stored figure
 * would drift a little every time somebody opened and saved the item. Keeping one canonical
 * currency and showing the conversion gives the reader their own units without that decay.
 */
export function PriceHint({ usd }: { usd: number | null }) {
	const { currency, fxRates } = usePreferences();

	if (usd == null || !Number.isFinite(usd) || currency === 'USD') {
		return null;
	}

	return (
		<p className="text-xs text-muted-foreground" data-testid="price-hint">
			≈ {formatMoney(usd, currency, fxRates)}
		</p>
	);
}
