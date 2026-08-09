import type { NextConfig } from 'next';
import withPWAInit, { runtimeCaching } from '@ducanh2912/next-pwa';
// Single source of truth for the version shown in Settings → About, so a deploy can be identified
// from the phone without guessing whether the new bundle actually landed. Bump `package.json` only.
import { version as appVersion } from './package.json';

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
		// `/offline`, NOT next-pwa's default `/~offline`. THE CAUSE OF PUSH NEVER TURNING ON.
		//
		// Hostinger's edge (`server: hcdn`) claims every path beginning with `~` the way Apache's
		// mod_userdir does, and 301s it to a trailing slash — even for paths that do not exist here.
		// Next then 308s the slash straight back off, because `trailingSlash` is false. The result is
		// an infinite redirect pair that only exists in production:
		//
		//     /~offline  -> 301 -> /~offline/
		//     /~offline/ -> 308 -> /~offline
		//
		// Workbox precaches this document during the service worker's `install` event, so that fetch
		// never resolved, `install` rejected, and NO worker ever reached `activated`. Everything that
		// waits on `navigator.serviceWorker.ready` then hangs forever — which is why enabling push
		// timed out, and why offline support was silently dead too. Localhost and Vercel are both
		// fine, so nothing catches this before a Hostinger deploy.
		document: '/offline',
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
			// The app frames nothing. The help guide briefly rendered in an iframe, which needed
			// 'self' here; it now opens in a browser tab instead, so this goes back to the stricter
			// value rather than being left permissive for a feature that no longer exists.
			"frame-src 'none'",
			"object-src 'none'",
			"base-uri 'self'",
			"form-action 'self'",
		].join('; '),
	},
];

const nextConfig: NextConfig = {
	env: {
		NEXT_PUBLIC_APP_VERSION: appVersion,
	},
	async headers() {
		return [
			{
				source: '/(.*)',
				headers: securityHeaders,
			},
			/*
			 * Service worker scripts must never be held by a cache. They shipped with no
			 * `Cache-Control` at all, so Hostinger's CDN applied its own TTL and cached `/sw.js` at the
			 * edge (`x-hcdn-cache-status: HIT`). A deploy then left the app in its worst possible
			 * state: the new build was live and serving new HTML, while every browser was still handed
			 * the PREVIOUS worker from the edge. That worker precaches the previous build's URLs, so
			 * fixing a bad precache entry did not take effect and could not be diagnosed from the
			 * deploy — the code was correct and the served worker was not.
			 *
			 * A worker is the one file whose staleness cannot be self-correcting: it is what decides
			 * what everything else serves. Browsers already bypass their own HTTP cache when checking
			 * for worker updates; this makes the CDN do the same.
			 */
			...['/sw.js', '/sw-extra.js', '/swe-worker-:hash.js', '/fallback-:hash.js'].map(source => ({
				source,
				headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
			})),
			/*
			 * Uploaded documents get their own, far stricter policy.
			 *
			 * Setting this inside the route handler does not work: the config headers are applied
			 * afterwards and overwrite it, so the documents inherited the app's policy — which permits
			 * inline script. These files can be replaced by upload without a code review, so they must
			 * be treated as untrusted content: no script, no network, no framing of anything else.
			 * `sandbox` applies even when the document is opened directly rather than in our iframe.
			 */
			{
				source: '/api/docs/:slug',
				headers: [
					{
						key: 'Content-Security-Policy',
						value: "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; font-src data:; sandbox",
					},
				],
			},
		];
	},
	// Clean URLs for the standalone legal documents, now served from storage.
	async rewrites() {
		return [
			// Served from Supabase storage rather than public/, so a wording change is an upload
			// rather than a deploy — and so the response actually carries our headers, which files
			// under public/ do not get on this host.
			{ source: '/terms', destination: '/api/docs/terms' },
			{ source: '/privacy', destination: '/api/docs/privacy' },
		];
	},
	// context.md is read at runtime by the help assistant. Next only bundles files it can see being
	// imported, and this one is read by path, so it has to be traced explicitly or the deployed
	// function has no reference material and every answer becomes "I do not know".
	outputFileTracingIncludes: {
		'/api/help-chat': ['./context.md'],
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
