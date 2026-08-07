import type React from 'react';
import type { Metadata, Viewport } from 'next';

import './globals.css';
import { ThemeProvider } from './providers';
import { PWAInstallGuard } from '@/components/providers/pwa-install-guard';
import { Plus_Jakarta_Sans, Poppins } from 'next/font/google';

const plusJakartaSans = Plus_Jakarta_Sans({
	subsets: ['latin'],
	variable: '--font-sans',
	display: 'swap',
});
// Trimmed weights: 500 is rarely used and 700 (bold) is now handled by Plus_Jakarta_Sans.
// Keep only display weights actually needed for the brand header/title typography.
const poppins = Poppins({
	subsets: ['latin'],
	weight: ['400', '600', '700'],
	variable: '--font-display',
	display: 'swap',
});

export const metadata: Metadata = {
	applicationName: 'ShareCircle',
	title: {
		default: 'ShareCircle - Share Items with Your Community',
		template: '%s | ShareCircle',
	},
	description:
		'Share, lend, and borrow items with trusted circles. Build community, save money, and reduce waste through peer-to-peer item sharing.',
	keywords: [
		'sharing economy',
		'item sharing',
		'borrow',
		'lend',
		'community',
		'peer-to-peer',
		'circular economy',
		'sustainability',
	],
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
		icon: '/icon',
		apple: '/apple-icon',
		shortcut: '/icon',
	},
	openGraph: {
		type: 'website',
		locale: 'en_US',
		url: 'https://sharecircle.app',
		siteName: 'ShareCircle',
		title: 'ShareCircle - Share Items with Your Community',
		description:
			'Share, lend, and borrow items with trusted circles. Build community, save money, and reduce waste.',
		images: [
			{
				url: '/logo_new.png',
				width: 1200,
				height: 630,
				alt: 'ShareCircle - Community Item Sharing',
			},
		],
	},
	twitter: {
		card: 'summary_large_image',
		title: 'ShareCircle - Share Items with Your Community',
		description:
			'Share, lend, and borrow items with trusted circles. Build community, save money, and reduce waste.',
		images: ['/logo_new.png'],
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
			<head>
				{/* Apply the saved theme and font size before first paint: avoids a flash-of-light,
				    a hydration mismatch on the theme toggle (matches ThemeProvider's 'light'
				    default), and a visible reflow when the root font size is not 16px.
				    Keep the size map in sync with FONT_SIZES in lib/preferences.ts. */}
				<script
					dangerouslySetInnerHTML={{
						__html: `try{var s=localStorage;if(s.getItem('sharecircle_theme')==='dark'){document.documentElement.classList.add('dark')}var f={sm:14,md:16,lg:18}[s.getItem('sharecircle_font_size')];if(f){document.documentElement.style.fontSize=f+'px'}}catch(e){}`,
					}}
				/>
			</head>
			<body className={`${plusJakartaSans.variable} ${poppins.variable} font-sans`}>
				<ThemeProvider>{children}</ThemeProvider>
				<PWAInstallGuard />
			</body>
		</html>
	);
}
