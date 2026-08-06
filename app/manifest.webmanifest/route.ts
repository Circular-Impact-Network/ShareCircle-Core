import { headers } from 'next/headers';

import { classifyUserAgent } from '@/lib/device';

/**
 * Web app manifest, served by hand rather than via `app/manifest.ts`, so that desktop
 * browsers receive a manifest that is deliberately *not* installable.
 *
 * Why this exists: suppressing `beforeinstallprompt` and gating our own install card only
 * removes ShareCircle's UI. Chrome and Edge additionally offer install from the omnibox icon
 * and the ⋯ menu, and a web page cannot remove browser chrome. The only lever a site has is
 * installability itself — Chromium requires `display` (or the first supported entry in
 * `display_override`) to be `fullscreen`, `standalone` or `minimal-ui`. Serving
 * `display: 'browser'` to desktop makes the app fail that criterion, so no install
 * affordance appears anywhere.
 *
 * Everything else — name, icons, theme colour — is served identically, so desktop keeps its
 * proper tab branding and the service worker keeps working offline.
 *
 * The failure mode is chosen carefully: a UA we cannot classify gets the installable variant.
 * Wrongly withholding install from a real phone is far worse than wrongly permitting it on an
 * unusual desktop, which the client-side card gate still catches.
 */

// UA-dependent, so it must never be cached by a shared cache and must be re-evaluated per
// request. `Vary: User-Agent` covers intermediaries that ignore no-store.
export const dynamic = 'force-dynamic';

const ICONS = [
	{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
	{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
	{ src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
	{ src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

/**
 * Chromium-family browsers, the only ones this gate affects.
 *
 * Scoping to Chromium avoids an iPad regression: iPadOS Safari sends the Macintosh UA, and
 * there is no reliable server-side way to tell it from a real Mac (Safari sends no Client
 * Hints). Withholding install from every iPad to catch Mac Safari would be a bad trade —
 * especially since it would achieve nothing, because macOS Safari's "Add to Dock" works on
 * any site regardless of the manifest. Firefox has no install flow at all. So Chrome and Edge
 * are both the browsers where install can be suppressed and the browsers actually reported.
 */
const CHROMIUM_UA_PATTERN = /Chrome\/|Chromium\/|Edg\/|OPR\//;

const SHORTCUTS = [
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
];

export async function GET() {
	const headerList = await headers();
	const userAgent = headerList.get('user-agent') ?? '';
	// Client Hints: Chromium sends Sec-CH-UA-Mobile as `?1` / `?0`. More reliable than the UA
	// string when present, and unaffected by UA reduction.
	// Low-entropy hint: Chromium sends it on every same-origin request with no Accept-CH
	// opt-in needed, including subresource fetches like this one.
	const chMobile = headerList.get('sec-ch-ua-mobile');
	const chPlatform = headerList.get('sec-ch-ua-platform')?.replace(/"/g, '') ?? null;

	const isChromium = chMobile !== null || CHROMIUM_UA_PATTERN.test(userAgent);
	const isDesktop =
		isChromium &&
		(chMobile === '?0' || (chMobile !== '?1' && classifyUserAgent(userAgent, chPlatform) === 'desktop'));

	const manifest = {
		name: 'ShareCircle',
		short_name: 'ShareCircle',
		description: 'Share, lend, and borrow items with your trusted circles.',
		start_url: '/home',
		scope: '/',
		// The single field that decides installability.
		display: isDesktop ? 'browser' : 'standalone',
		...(isDesktop ? {} : { display_override: ['standalone', 'minimal-ui', 'browser'] }),
		background_color: '#0b1220',
		theme_color: '#0f172a',
		orientation: 'portrait',
		categories: ['social', 'lifestyle', 'productivity'],
		lang: 'en',
		icons: ICONS,
		shortcuts: SHORTCUTS,
	};

	return new Response(JSON.stringify(manifest), {
		headers: {
			'Content-Type': 'application/manifest+json; charset=utf-8',
			'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
			Vary: 'User-Agent, Sec-CH-UA-Mobile, Sec-CH-UA-Platform',
		},
	});
}
