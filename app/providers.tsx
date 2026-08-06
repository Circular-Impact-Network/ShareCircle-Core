'use client';

import type React from 'react';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from 'react';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from '@/components/ui/toaster';
import { Provider as ReduxProvider } from 'react-redux';
import { PWAProvider } from '@/components/pwa/pwa-provider';
import { store } from '@/lib/redux';
import { DEFAULT_CURRENCY, FALLBACK_RATES, type CurrencyCode, type FxRates } from '@/lib/currency';
import {
	PREFERENCE_STORAGE_KEYS,
	applyFontSize,
	coerceCurrency,
	coerceFontSize,
	coerceWeightUnit,
	DEFAULT_FONT_SIZE,
	DEFAULT_WEIGHT_UNIT,
	type FontSizeKey,
} from '@/lib/preferences';
import type { WeightUnit } from '@/lib/units';

type PreferencesContextType = {
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

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

/** localStorage throws in some private-browsing modes; never let that break the app. */
function readStored(key: string): string | null {
	if (typeof window === 'undefined') {
		return null;
	}
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
}

function writeStored(key: string, value: string): void {
	try {
		window.localStorage.setItem(key, value);
	} catch {
		// Preference simply won't persist; the in-memory value still applies.
	}
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setTheme] = useState<string>(() => readStored(PREFERENCE_STORAGE_KEYS.theme) ?? 'light');
	const [fontSize, setFontSizeState] = useState<FontSizeKey>(() =>
		coerceFontSize(readStored(PREFERENCE_STORAGE_KEYS.fontSize) ?? DEFAULT_FONT_SIZE),
	);
	const [weightUnit, setWeightUnitState] = useState<WeightUnit>(() =>
		coerceWeightUnit(readStored(PREFERENCE_STORAGE_KEYS.weightUnit) ?? DEFAULT_WEIGHT_UNIT),
	);
	const [currency, setCurrencyState] = useState<CurrencyCode>(() =>
		coerceCurrency(readStored(PREFERENCE_STORAGE_KEYS.currency) ?? DEFAULT_CURRENCY),
	);
	const [fxRates, setFxRates] = useState<FxRates>(FALLBACK_RATES);
	const [fxLoaded, setFxLoaded] = useState(false);

	const applyTheme = (newTheme: string) => {
		const htmlElement = document.documentElement;
		if (newTheme === 'dark') {
			htmlElement.classList.add('dark');
		} else {
			htmlElement.classList.remove('dark');
		}
	};

	useLayoutEffect(() => {
		applyTheme(theme);
	}, [theme]);

	useLayoutEffect(() => {
		applyFontSize(fontSize);
	}, [fontSize]);

	// Only reach for live rates when they can actually change a rendered number. A
	// USD user never needs them, and FALLBACK_RATES already covers the failure case.
	useEffect(() => {
		if (currency === 'USD' || fxLoaded) {
			return;
		}

		let cancelled = false;
		void (async () => {
			try {
				const res = await fetch('/api/fx');
				if (!res.ok) {
					return;
				}
				const data = (await res.json()) as { rates?: Partial<FxRates> };
				if (!cancelled && data.rates) {
					setFxRates({ ...FALLBACK_RATES, ...data.rates });
					setFxLoaded(true);
				}
			} catch {
				// Keep FALLBACK_RATES — prices still render, just approximately.
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [currency, fxLoaded]);

	const toggleTheme = useCallback(() => {
		setTheme(prev => {
			const next = prev === 'light' ? 'dark' : 'light';
			writeStored(PREFERENCE_STORAGE_KEYS.theme, next);
			applyTheme(next);
			return next;
		});
	}, []);

	const setFontSize = useCallback((value: FontSizeKey) => {
		setFontSizeState(value);
		writeStored(PREFERENCE_STORAGE_KEYS.fontSize, value);
		applyFontSize(value);
	}, []);

	const setWeightUnit = useCallback((value: WeightUnit) => {
		setWeightUnitState(value);
		writeStored(PREFERENCE_STORAGE_KEYS.weightUnit, value);
	}, []);

	const setCurrency = useCallback((value: CurrencyCode) => {
		setCurrencyState(value);
		writeStored(PREFERENCE_STORAGE_KEYS.currency, value);
	}, []);

	return (
		<ReduxProvider store={store}>
			<SessionProvider>
				<PreferencesContext.Provider
					value={{
						theme,
						toggleTheme,
						fontSize,
						setFontSize,
						weightUnit,
						setWeightUnit,
						currency,
						setCurrency,
						fxRates,
					}}
				>
					{children}
					<PWAProvider />
					<Toaster />
				</PreferencesContext.Provider>
			</SessionProvider>
		</ReduxProvider>
	);
}

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
