import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: 'ShareCircle',
		short_name: 'ShareCircle',
		description: 'Share, lend, and borrow items with your trusted circles.',
		start_url: '/',
		scope: '/',
		display: 'standalone',
		display_override: ['standalone', 'minimal-ui', 'browser'],
		background_color: '#0b1220',
		theme_color: '#0f172a',
		orientation: 'portrait',
		categories: ['social', 'lifestyle', 'productivity'],
		lang: 'en',
		icons: [
			{
				src: '/icon',
				sizes: 'any',
				type: 'image/png',
				purpose: 'any',
			},
			{
				src: '/icon',
				sizes: 'any',
				type: 'image/png',
				purpose: 'maskable',
			},
			{
				src: '/apple-icon',
				sizes: '180x180',
				type: 'image/png',
			},
		],
		screenshots: [
			{
				src: '/icon',
				sizes: 'any',
				type: 'image/png',
				form_factor: 'wide',
				label: 'ShareCircle app preview',
			},
		],
		shortcuts: [
			{
				name: 'Browse Items',
				short_name: 'Browse',
				description: 'See items available in your circles.',
				url: '/browse',
			},
			{
				name: 'Messages',
				short_name: 'Messages',
				description: 'Open your conversations.',
				url: '/messages',
			},
			{
				name: 'My Listings',
				short_name: 'Listings',
				description: 'Manage your shared items.',
				url: '/listings',
			},
		],
	};
}
