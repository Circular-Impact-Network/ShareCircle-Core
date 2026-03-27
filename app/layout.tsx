import type React from 'react';
import type { Metadata, Viewport } from 'next';

import './globals.css';
import { ThemeProvider } from './providers';
import {
	Inter,
	Poppins,
	Plus_Jakarta_Sans as V0_Font_Plus_Jakarta_Sans,
	Geist_Mono as V0_Font_Geist_Mono,
	Source_Serif_4 as V0_Font_Source_Serif_4,
} from 'next/font/google';

// Initialize fonts (kept for potential future use)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _plusJakartaSans = V0_Font_Plus_Jakarta_Sans({
	subsets: ['latin'],
	weight: ['200', '300', '400', '500', '600', '700', '800'],
});
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _geistMono = V0_Font_Geist_Mono({
	subsets: ['latin'],
	weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
});
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _sourceSerif_4 = V0_Font_Source_Serif_4({
	subsets: ['latin'],
	weight: ['200', '300', '400', '500', '600', '700', '800', '900'],
});

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-display' });

export const metadata: Metadata = {
	applicationName: 'ShareCircle',
	title: {
		default: 'ShareCircle - Share Items with Your Community',
		template: '%s | ShareCircle',
	},
	description: 'Share, lend, and borrow items with trusted circles. Build community, save money, and reduce waste through peer-to-peer item sharing.',
	keywords: ['sharing economy', 'item sharing', 'borrow', 'lend', 'community', 'peer-to-peer', 'circular economy', 'sustainability'],
	authors: [{ name: 'ShareCircle Team' }],
	creator: 'ShareCircle',
	publisher: 'ShareCircle',
	manifest: '/manifest.webmanifest',
	appleWebApp: {
		capable: true,
		statusBarStyle: 'default',
		title: 'ShareCircle',
	},
	formatDetection: {
		telephone: false,
	},
	icons: {
		icon: [
			{ url: '/icon', sizes: 'any', type: 'image/png' },
			{ url: '/share-circle-logo-no-name.png', sizes: '512x512', type: 'image/png' },
		],
		apple: [
			{ url: '/apple-icon', sizes: '180x180', type: 'image/png' },
		],
		shortcut: '/share-circle-logo-no-name.png',
	},
	openGraph: {
		type: 'website',
		locale: 'en_US',
		url: 'https://sharecircle.app',
		siteName: 'ShareCircle',
		title: 'ShareCircle - Share Items with Your Community',
		description: 'Share, lend, and borrow items with trusted circles. Build community, save money, and reduce waste.',
		images: [
			{
				url: '/share-circle-logo.png',
				width: 1200,
				height: 630,
				alt: 'ShareCircle - Community Item Sharing',
			},
		],
	},
	twitter: {
		card: 'summary_large_image',
		title: 'ShareCircle - Share Items with Your Community',
		description: 'Share, lend, and borrow items with trusted circles. Build community, save money, and reduce waste.',
		images: ['/share-circle-logo.png'],
		creator: '@sharecircle',
	},
	robots: {
		index: true,
		follow: true,
		googleBot: {
			index: true,
			follow: true,
			'max-video-preview': -1,
			'max-image-preview': 'large',
			'max-snippet': -1,
		},
	},
	category: 'technology',
};

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	viewportFit: 'cover',
	themeColor: [
		{ media: '(prefers-color-scheme: light)', color: '#eff6ff' },
		{ media: '(prefers-color-scheme: dark)', color: '#0f172a' },
	],
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
