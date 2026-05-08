'use client';

import type React from 'react';

import { createContext, useContext, useLayoutEffect, useState } from 'react';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from '@/components/ui/toaster';
import { Provider as ReduxProvider } from 'react-redux';
import { PWAProvider } from '@/components/pwa/pwa-provider';
import { store } from '@/lib/redux';

type ThemeContextType = {
	theme: string;
	toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setTheme] = useState<string>(
		() => (typeof window !== 'undefined' ? (localStorage.getItem('sharecircle_theme') ?? 'light') : 'light'),
	);

	const updateTheme = (newTheme: string) => {
		const htmlElement = document.documentElement;
		if (newTheme === 'dark') {
			htmlElement.classList.add('dark');
		} else {
			htmlElement.classList.remove('dark');
		}
	};

	useLayoutEffect(() => {
		updateTheme(theme);
	}, [theme]);

	const toggleTheme = () => {
		const newTheme = theme === 'light' ? 'dark' : 'light';
		setTheme(newTheme);
		localStorage.setItem('sharecircle_theme', newTheme);
		updateTheme(newTheme);
	};

	return (
		<ReduxProvider store={store}>
			<SessionProvider>
				<ThemeContext.Provider value={{ theme, toggleTheme }}>
					{children}
					<PWAProvider />
					<Toaster />
				</ThemeContext.Provider>
			</SessionProvider>
		</ReduxProvider>
	);
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (!context) {
		throw new Error('useTheme must be used within ThemeProvider');
	}
	return context;
}
