'use client';

import type React from 'react';

import { createContext, useContext, useEffect, useState } from 'react';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from '@/components/ui/toaster';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from '@/lib/redux';

type ThemeContextType = {
	theme: string;
	toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setTheme] = useState('light');
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		const savedTheme = localStorage.getItem('sharecircle_theme') || 'light';
		setTheme(savedTheme);
		updateTheme(savedTheme);
		setMounted(true);
	}, []);

	const updateTheme = (newTheme: string) => {
		const htmlElement = document.documentElement;
		if (newTheme === 'dark') {
			htmlElement.classList.add('dark');
		} else {
			htmlElement.classList.remove('dark');
		}
	};

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
