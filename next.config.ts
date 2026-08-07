import type { NextConfig } from 'next';
import withPWAInit, { runtimeCaching } from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
	dest: 'public',
	disable: process.env.NODE_ENV === 'development',
	register: false,
	cacheOnFrontEndNav: true,
	// Was `true`, and it reloads the page on every `online` event. On a phone that flaps between
	// wifi and mobile data that turns into repeated reloads, which reads as the app freezing or
	// getting stuck. Update handling is explicit in pwa-provider instead.
	reloadOnOnline: false,
	fallbacks: {
		document: '/~offline',
	},
	workboxOptions: {
		// THE CAUSE OF THE POST-DEPLOY ChunkLoadError.
		//
		// Without these, a new service worker installs and then *waits* until every tab using the
		// old one closes. An installed PWA effectively never closes, so users kept running the
		// previous worker, which served HTML from its own precache — HTML referencing chunk hashes
		// from a build whose files the deploy had already replaced. The chunk 404s, React never
		// hydrates, and the page sits on a spinner or throws `ChunkLoadError`.
		//
		// `skipWaiting` activates the new worker immediately, `clientsClaim` puts existing tabs
		// under it, and `cleanupOutdatedCaches` deletes the stale precache rather than leaving it
		// to serve dead URLs.
		skipWaiting: true,
		clientsClaim: true,
		cleanupOutdatedCaches: true,
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
					// 15s meant a slow phone stared at a blank page for fifteen seconds before the
					// cache was consulted at all. Five is long enough to prefer the network and
					// short enough that a bad connection still renders something.
					networkTimeoutSeconds: 5,
					expiration: {
						maxEntries: 40,
						maxAgeSeconds: 60 * 60,
					},
					cacheableResponse: {
						statuses: [200],
					},
				},
			},
			// The manifest is generated per-request from the user agent (see
			// app/manifest.webmanifest/route.ts) and must never be served from a cache, or a
			// stale copy could keep offering install on desktop after this shipped.
			{
				urlPattern: ({ url }: { url: URL }) => url.pathname === '/manifest.webmanifest',
				handler: 'NetworkOnly',
			},
			...runtimeCaching,
		],
	},
});

const isDev = process.env.NODE_ENV !== 'production';

const securityHeaders = [
	{ key: 'X-Content-Type-Options', value: 'nosniff' },
	{ key: 'X-Frame-Options', value: 'DENY' },
	{ key: 'X-XSS-Protection', value: '1; mode=block' },
	{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
	// geolocation=(self): signup needs the Geolocation API on our own origin. An empty
	// allowlist — geolocation=() — disables the API outright, so getCurrentPosition never
	// prompts and fires the error callback immediately (Chrome/Safari; Firefox ignores the
	// policy for geolocation, which is why this only broke for some users). Same-origin
	// only; embedded frames still cannot use it.
	{ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=()' },
	{
		key: 'Strict-Transport-Security',
		value: 'max-age=63072000; includeSubDomains; preload',
	},
	{
		key: 'Content-Security-Policy',
		value: [
			"default-src 'self'",
			// `unsafe-eval` is only needed by the dev server's HMR runtime, so it is scoped to
			// development. Shipping it made the CSP close to decorative: with eval available, any
			// injected string becomes executable code. `unsafe-inline` has to stay for now — Next's
			// RSC payload and the PWA register script are inlined without a nonce — so this is a
			// reduction in blast radius, not a complete defence.
			isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self' 'unsafe-inline'",
			// fonts.googleapis.com / fonts.gstatic.com: the standalone legal pages (/terms, /privacy) load Google Fonts.
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
			"img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com",
			"font-src 'self' data: https://fonts.gstatic.com",
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
	// Serve the pre-designed standalone legal documents (in public/legal) at clean URLs.
	async rewrites() {
		return [
			{ source: '/terms', destination: '/legal/terms.html' },
			{ source: '/privacy', destination: '/legal/privacy.html' },
		];
	},
	serverExternalPackages: ['@prisma/client', 'prisma'],
	experimental: {
		optimizePackageImports: [
			'lucide-react',
			'date-fns',
			'@radix-ui/react-alert-dialog',
			'@radix-ui/react-avatar',
			'@radix-ui/react-checkbox',
			'@radix-ui/react-collapsible',
			'@radix-ui/react-dialog',
			'@radix-ui/react-dropdown-menu',
			'@radix-ui/react-label',
			'@radix-ui/react-popover',
			'@radix-ui/react-progress',
			'@radix-ui/react-radio-group',
			'@radix-ui/react-scroll-area',
			'@radix-ui/react-select',
			'@radix-ui/react-separator',
			'@radix-ui/react-slot',
			'@radix-ui/react-switch',
			'@radix-ui/react-tabs',
			'@radix-ui/react-toast',
			'@radix-ui/react-tooltip',
		],
	},
	images: {
		formats: ['image/webp', 'image/avif'],
		deviceSizes: [640, 750, 1080, 1920],
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
