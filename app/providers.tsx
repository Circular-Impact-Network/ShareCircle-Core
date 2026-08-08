'use client';

import type React from 'react';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
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
import { PreferencesContext } from '@/lib/preferences-context';

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

/** Shape of GET /api/preferences. `stored` is false until the account has saved once. */
type StoredPreferences = {
	theme?: string;
	fontSize?: string;
	weightUnit?: string;
	currency?: string;
	stored?: boolean;
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	// Preferences must sit inside SessionProvider so they can be read from and written to the
	// account. They are deliberately not a server component concern: nothing rendered on the server
	// can know them, so every unit-aware number is formatted on the client.
	return (
		<ReduxProvider store={store}>
			<SessionProvider>
				<PreferencesProvider>{children}</PreferencesProvider>
			</SessionProvider>
		</ReduxProvider>
	);
}

function PreferencesProvider({ children }: { children: React.ReactNode }) {
	const { status } = useSession();
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

	/**
	 * Persist to the account, fire and forget.
	 *
	 * The local write has already happened by the time this runs, so a failed request costs the user
	 * nothing in this session — the preference still applies and still survives a reload here. It
	 * simply will not follow them to another device, which is worth a console line and not a toast.
	 */
	const persist = useCallback(
		(patch: Record<string, string>) => {
			if (status !== 'authenticated') {
				return;
			}
			void fetch('/api/preferences', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(patch),
			}).catch(error => console.error('Failed to save preferences to your account:', error));
		},
		[status],
	);

	/**
	 * Adopt the account's preferences once signed in, or lift this browser's existing choice up to
	 * the account the first time.
	 *
	 * Order matters. The server wins whenever it holds a saved row, because that is the choice the
	 * user made most recently on some device. Only when nothing has ever been saved do we push the
	 * local values up — otherwise a browser that was never updated would overwrite a newer choice
	 * made elsewhere with its own stale one.
	 */
	const syncedRef = useRef(false);
	useEffect(() => {
		if (status !== 'authenticated' || syncedRef.current) {
			return;
		}
		syncedRef.current = true;

		let cancelled = false;
		void (async () => {
			try {
				const res = await fetch('/api/preferences', { credentials: 'include' });
				if (!res.ok || cancelled) {
					return;
				}
				const remote = (await res.json()) as StoredPreferences;

				if (!remote.stored) {
					persist({ theme, fontSize, weightUnit, currency });
					return;
				}

				const nextTheme = remote.theme === 'dark' ? 'dark' : 'light';
				const nextFontSize = coerceFontSize(remote.fontSize);
				setTheme(nextTheme);
				applyTheme(nextTheme);
				setFontSizeState(nextFontSize);
				applyFontSize(nextFontSize);
				setWeightUnitState(coerceWeightUnit(remote.weightUnit));
				setCurrencyState(coerceCurrency(remote.currency));

				writeStored(PREFERENCE_STORAGE_KEYS.theme, nextTheme);
				writeStored(PREFERENCE_STORAGE_KEYS.fontSize, nextFontSize);
				writeStored(PREFERENCE_STORAGE_KEYS.weightUnit, coerceWeightUnit(remote.weightUnit));
				writeStored(PREFERENCE_STORAGE_KEYS.currency, coerceCurrency(remote.currency));
			} catch (error) {
				// The locally stored values remain in force; this only costs cross-device sync.
				console.error('Failed to load preferences from your account:', error);
			}
		})();

		return () => {
			cancelled = true;
		};
		// Deliberately keyed on `status` alone: this runs once per sign-in, and including the
		// preference values would re-run it on every change and fight the user's own edits.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [status]);

	const toggleTheme = useCallback(() => {
		setTheme(prev => {
			const next = prev === 'light' ? 'dark' : 'light';
			writeStored(PREFERENCE_STORAGE_KEYS.theme, next);
			applyTheme(next);
			persist({ theme: next });
			return next;
		});
	}, [persist]);

	const setFontSize = useCallback(
		(value: FontSizeKey) => {
			setFontSizeState(value);
			writeStored(PREFERENCE_STORAGE_KEYS.fontSize, value);
			applyFontSize(value);
			persist({ fontSize: value });
		},
		[persist],
	);

	const setWeightUnit = useCallback(
		(value: WeightUnit) => {
			setWeightUnitState(value);
			writeStored(PREFERENCE_STORAGE_KEYS.weightUnit, value);
			persist({ weightUnit: value });
		},
		[persist],
	);

	const setCurrency = useCallback(
		(value: CurrencyCode) => {
			setCurrencyState(value);
			writeStored(PREFERENCE_STORAGE_KEYS.currency, value);
			persist({ currency: value });
		},
		[persist],
	);

	return (
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
	);
}

// Re-exported so the many existing `from '@/app/providers'` imports keep working.
export { usePreferences, useTheme } from '@/lib/preferences-context';
