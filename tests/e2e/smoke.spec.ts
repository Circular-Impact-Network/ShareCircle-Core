import { test, expect } from '@playwright/test';

// Minimal smoke tests for production — read-only, no data mutations
test.describe('smoke', () => {
	test('root redirects to login when signed out', async ({ page }) => {
		// Marketing moved to circularimpact.org/sharecircle; the app root only routes.
		await page.goto('/');
		await expect(page).toHaveURL(/\/login/);
		await expect(page).toHaveTitle(/ShareCircle/i);
	});

	test('login page loads', async ({ page }) => {
		await page.goto('/login');
		await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
	});

	test('health: API responds', async ({ request }) => {
		const res = await request.get('/api/auth/providers');
		expect(res.status()).toBeLessThan(500);
	});

	/**
	 * Every URL the service worker precaches must be fetchable on the real host.
	 *
	 * Workbox precaches during `install`, so ONE unfetchable URL rejects the install and no worker
	 * ever activates — which silently kills push notifications and offline support together, with
	 * no error surfaced anywhere in the app. That is exactly what `/~offline` did: Hostinger's edge
	 * 301s any `~` path to a trailing slash and Next 308s it back, an infinite pair that exists only
	 * in production. No local or preview run can reproduce a host's own redirect rules, so this has
	 * to assert against the deployed origin.
	 */
	test('service worker precache manifest is fully fetchable', async ({ request }) => {
		const sw = await request.get('/sw.js');
		expect(sw.status()).toBe(200);

		const manifest = await sw.text();
		// Workbox emits precache entries as `{url:"...",revision:...}`. Matching that exact shape
		// rather than every quoted path matters: the file also contains `runtimeCaching` matchers like
		// `pathname.startsWith("/api/auth/")`, which are route prefixes and not fetchable assets.
		// A looser regex swept those in and reported `/api/` as a broken precache entry.
		const urls = [
			...new Set(
				[...manifest.matchAll(/\{\s*url\s*:\s*"([^"]+)"\s*,\s*revision\s*:\s*(?:"[^"]*"|null)\s*\}/g)].map(
					match => match[1],
				),
			),
		].filter(url => url.startsWith('/') && !url.startsWith('//'));

		// Guards the extraction itself: a manifest format change that matched nothing would otherwise
		// make every assertion below trivially pass.
		expect(urls.length).toBeGreaterThan(50);

		// A `~` prefix is reserved by Apache-style userdir handling on the production host, so it can
		// never be fetched there regardless of what the app defines.
		expect(urls.filter(url => url.startsWith('/~'))).toEqual([]);

		const documents = urls.filter(url => !url.startsWith('/_next/static/'));
		const broken: string[] = [];
		for (const url of documents) {
			try {
				const res = await request.get(url, { maxRedirects: 5 });
				if (res.status() >= 400) {
					broken.push(`${url} -> ${res.status()}`);
				}
			} catch (error) {
				// A redirect loop exhausts maxRedirects and throws rather than returning a response.
				broken.push(`${url} -> ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		expect(broken, 'precached URLs that the host cannot serve').toEqual([]);
	});
});
