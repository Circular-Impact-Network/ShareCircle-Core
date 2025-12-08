import type React from 'react';
import type { Metadata } from 'next';

import './globals.css';
import { ThemeProvider } from './providers';
import {
	Inter,
	Poppins,
	Plus_Jakarta_Sans as V0_Font_Plus_Jakarta_Sans,
	Geist_Mono as V0_Font_Geist_Mono,
	Source_Serif_4 as V0_Font_Source_Serif_4,
} from 'next/font/google';

// Initialize fonts
const _plusJakartaSans = V0_Font_Plus_Jakarta_Sans({
	subsets: ['latin'],
	weight: ['200', '300', '400', '500', '600', '700', '800'],
});
const _geistMono = V0_Font_Geist_Mono({
	subsets: ['latin'],
	weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
});
const _sourceSerif_4 = V0_Font_Source_Serif_4({
	subsets: ['latin'],
	weight: ['200', '300', '400', '500', '600', '700', '800', '900'],
});

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-display' });

export const metadata: Metadata = {
	title: 'ShareCircle - Share Items with Your Community',
	description: 'Share, lend, and borrow items with trusted circles',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${inter.variable} ${poppins.variable} font-sans`}>
				<ThemeProvider>{children}</ThemeProvider>
			</body>
		</html>
	);
}
