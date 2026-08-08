'use client';

import { createContext, useContext } from 'react';
import type { CurrencyCode, FxRates } from '@/lib/currency';
import type { FontSizeKey } from '@/lib/preferences';
import type { WeightUnit } from '@/lib/units';

/**
 * The preferences context and its hooks, separated from the provider that fills them.
 *
 * `app/providers.tsx` pulls in the Redux store, the session provider and the PWA provider. Any
 * component that merely wanted to read the user's unit therefore dragged the entire application
 * root in behind it, which is both a large import graph for a two-line formatter and a real
 * obstacle to testing a component in isolation. The context lives here so reading a preference
 * costs nothing but the context.
 */
export type PreferencesContextType = {
	theme: string;
	toggleTheme: () => void;
	fontSize: FontSizeKey;
	setFontSize: (value: FontSizeKey) => void;
	weightUnit: WeightUnit;
	setWeightUnit: (value: WeightUnit) => void;
	currency: CurrencyCode;
	setCurrency: (value: CurrencyCode) => void;
	/** USD -> currency multipliers. Falls back to the bundled table if /api/fx is down. */
	fxRates: FxRates;
};

export const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function usePreferences() {
	const context = useContext(PreferencesContext);
	if (!context) {
		throw new Error('usePreferences must be used within ThemeProvider');
	}
	return context;
}

/** Back-compat alias — theme was the only preference before font size / units / currency. */
export function useTheme() {
	return usePreferences();
}
