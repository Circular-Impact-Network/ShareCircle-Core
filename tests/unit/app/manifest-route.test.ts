import { describe, expect, it, vi } from 'vitest';

const headerStore = { value: new Headers() };
vi.mock('next/headers', () => ({ headers: async () => headerStore.value }));

const { GET } = await import('@/app/manifest.webmanifest/route');

/**
 * Requirement (2026-08-05): "be 100% sure that we do not allow to install app on a laptop,
 * since that doesnt work... That popup should only come on MOBILE devices."
 *
 * Suppressing `beforeinstallprompt` only hides ShareCircle's own card; Chrome and Edge keep
 * their omnibox install button, which a page cannot remove. The only lever a site has is
 * installability, and Chromium requires `display` (or the first supported `display_override`
 * entry) to be fullscreen/standalone/minimal-ui. Serving `display: 'browser'` fails that.
 */
const UA = {
	windowsEdge:
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
	windowsChrome:
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
	macChrome:
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
	chromeOs:
		'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
	linuxFirefox: 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
	macSafari:
		'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
	androidChrome:
		'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
	samsung:
		'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
	iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
};

async function fetchManifest(headers: Record<string, string>) {
	headerStore.value = new Headers(headers);
	const response = await GET();
	return { response, manifest: await response.json() };
}

/** What Chromium actually checks: display_override's first supported entry, else display. */
function isInstallable(manifest: { display: string; display_override?: string[] }) {
	const effective = manifest.display_override?.[0] ?? manifest.display;
	return ['fullscreen', 'standalone', 'minimal-ui'].includes(effective);
}

describe('GET /manifest.webmanifest', () => {
	describe('desktop Chromium is served a non-installable manifest', () => {
		it.each([
			['Windows / Edge — the reported case', UA.windowsEdge],
			['Windows / Chrome', UA.windowsChrome],
			['macOS / Chrome', UA.macChrome],
			['ChromeOS', UA.chromeOs],
		])('%s', async (_label, userAgent) => {
			const { manifest } = await fetchManifest({ 'user-agent': userAgent });
			expect(manifest.display).toBe('browser');
			expect(manifest.display_override).toBeUndefined();
			expect(isInstallable(manifest)).toBe(false);
		});

		it('trusts Sec-CH-UA-Mobile: ?0 even on a touchscreen laptop', async () => {
			const { manifest } = await fetchManifest({
				'user-agent': UA.windowsChrome,
				'sec-ch-ua-mobile': '?0',
			});
			expect(isInstallable(manifest)).toBe(false);
		});
	});

	describe('mobile stays installable', () => {
		it.each([
			['Android / Chrome', UA.androidChrome],
			['Android / Samsung Internet', UA.samsung],
			['iPhone / Safari', UA.iphone],
		])('%s', async (_label, userAgent) => {
			const { manifest } = await fetchManifest({ 'user-agent': userAgent });
			expect(manifest.display).toBe('standalone');
			expect(isInstallable(manifest)).toBe(true);
		});

		it('trusts Sec-CH-UA-Mobile: ?1 over the UA string', async () => {
			const { manifest } = await fetchManifest({
				'user-agent': UA.windowsChrome,
				'sec-ch-ua-mobile': '?1',
			});
			expect(isInstallable(manifest)).toBe(true);
		});
	});

	describe('non-Chromium browsers are left alone', () => {
		// The gate cannot work there and scoping it away avoids collateral damage: iPadOS
		// Safari sends the Macintosh UA with no Client Hints, so a broad rule would strip
		// install from every iPad to chase macOS Safari — where "Add to Dock" ignores the
		// manifest anyway. Firefox has no install flow at all.
		it.each([
			['macOS or iPadOS Safari', UA.macSafari],
			['Linux / Firefox', UA.linuxFirefox],
		])('%s stays installable', async (_label, userAgent) => {
			const { manifest } = await fetchManifest({ 'user-agent': userAgent });
			expect(isInstallable(manifest)).toBe(true);
		});
	});

	it('fails open for an unrecognised or absent user agent', async () => {
		// Wrongly withholding install from a real phone is worse than wrongly permitting it on
		// an exotic desktop, which the client-side card gate still catches.
		const { manifest } = await fetchManifest({});
		expect(isInstallable(manifest)).toBe(true);
	});

	describe('response contract', () => {
		it('serves the manifest content type and forbids shared caching', async () => {
			const { response } = await fetchManifest({ 'user-agent': UA.windowsEdge });

			expect(response.headers.get('content-type')).toContain('application/manifest+json');
			// UA-dependent body: a shared cache must never reuse one variant for another device.
			expect(response.headers.get('cache-control')).toContain('no-store');
			const vary = response.headers.get('vary') ?? '';
			expect(vary).toContain('User-Agent');
			expect(vary).toContain('Sec-CH-UA-Mobile');
		});

		it('keeps identity, icons and shortcuts identical across device classes', async () => {
			// Only installability changes — desktop keeps correct tab branding, and the service
			// worker keeps working offline.
			const desktop = (await fetchManifest({ 'user-agent': UA.windowsEdge })).manifest;
			const mobile = (await fetchManifest({ 'user-agent': UA.androidChrome })).manifest;

			for (const key of ['name', 'short_name', 'description', 'start_url', 'scope', 'theme_color', 'lang']) {
				expect(desktop[key]).toEqual(mobile[key]);
			}
			expect(desktop.icons).toEqual(mobile.icons);
			expect(desktop.shortcuts).toEqual(mobile.shortcuts);
			expect(desktop.icons.map((icon: { sizes: string }) => icon.sizes)).toContain('512x512');
		});
	});
});
