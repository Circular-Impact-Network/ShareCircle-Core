import type { NextConfig } from 'next';
import withPWAInit, { runtimeCaching } from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
	dest: 'public',
	disable: process.env.NODE_ENV === 'development',
	register: false,
	cacheOnFrontEndNav: true,
	reloadOnOnline: true,
	fallbacks: {
		document: '/~offline',
	},
	workboxOptions: {
		importScripts: ['/sw-extra.js'],
		runtimeCaching: [
			{
				urlPattern: ({ request, url }) =>
					request.url.startsWith('http') && url.pathname.startsWith('/api/auth/'),
				handler: 'NetworkOnly',
			},
			{
				urlPattern: ({ request, url }) =>
					request.url.startsWith('http') && url.pathname.startsWith('/api/') && request.method !== 'GET',
				handler: 'NetworkOnly',
			},
			{
				urlPattern: ({ request, url }) =>
					request.url.startsWith('http') &&
					request.method === 'GET' &&
					/^\/api\/(items|circles|notifications|messages)/.test(url.pathname),
				handler: 'NetworkFirst',
				options: {
					cacheName: 'sharecircle-api-read-cache',
					networkTimeoutSeconds: 10,
					expiration: {
						maxEntries: 80,
						maxAgeSeconds: 60 * 5,
					},
					cacheableResponse: {
						statuses: [200],
					},
				},
			},
			// Document navigations: NetworkFirst with a generous timeout so Vercel
			// cold starts don't trip the offline fallback for genuinely-online users.
			// Only cache successful 200 responses (skip 3xx redirects and auth states).
			{
				urlPattern: ({ request, url }) => request.url.startsWith('http') && request.destination === 'document',
				handler: 'NetworkFirst',
				options: {
					cacheName: 'sharecircle-page-cache',
					networkTimeoutSeconds: 15,
					expiration: {
						maxEntries: 40,
						maxAgeSeconds: 60 * 60,
					},
					cacheableResponse: {
						statuses: [200],
					},
				},
			},
			...runtimeCaching,
		],
	},
});

const securityHeaders = [
	{ key: 'X-Content-Type-Options', value: 'nosniff' },
	{ key: 'X-Frame-Options', value: 'DENY' },
	{ key: 'X-XSS-Protection', value: '1; mode=block' },
	{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
	{ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
	{
		key: 'Strict-Transport-Security',
		value: 'max-age=63072000; includeSubDomains; preload',
	},
	{
		key: 'Content-Security-Policy',
		value: [
			"default-src 'self'",
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-eval needed for Next.js dev, unsafe-inline for some RSC patterns
			"style-src 'self' 'unsafe-inline'",
			"img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com",
			"font-src 'self' data:",
			"connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com",
			"frame-src 'none'",
			"object-src 'none'",
			"base-uri 'self'",
			"form-action 'self'",
		].join('; '),
	},
];

const nextConfig: NextConfig = {
	async headers() {
		return [
			{
				source: '/(.*)',
				headers: securityHeaders,
			},
		];
	},
	serverExternalPackages: ['@prisma/client', 'prisma'],
	experimental: {
		optimizePackageImports: [
			'lucide-react',
			'date-fns',
			'@radix-ui/react-dialog',
			'@radix-ui/react-dropdown-menu',
			'@radix-ui/react-select',
			'@radix-ui/react-tabs',
			'@radix-ui/react-avatar',
			'@radix-ui/react-collapsible',
			'@radix-ui/react-scroll-area',
			'@radix-ui/react-switch',
			'@radix-ui/react-tooltip',
		],
	},
	images: {
		formats: ['image/webp', 'image/avif'],
		deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
		imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
		minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
		remotePatterns: [
			{
				protocol: 'https',
				hostname: '**.supabase.co',
				pathname: '/storage/v1/object/**',
			},
			{
				protocol: 'https',
				hostname: 'lh3.googleusercontent.com',
				pathname: '/**',
			},
		],
	},
};

export default withPWA(nextConfig);
