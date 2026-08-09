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
	 * The stored documents must actually be present in this environment's bucket.
	 *
	 * `/terms` and `/privacy` are linked from signup and from emails, and they are now served from
	 * Supabase storage rather than from the repository — so a bucket that was never populated takes
	 * the legal pages down while every test that reads from a populated one still passes. That is
	 * exactly the gap found by hand before this shipped: the dev bucket had all three documents and
	 * production had none.
	 */
	test('stored documents are present and served as HTML', async ({ request }) => {
		const missing: string[] = [];

		for (const path of ['/api/docs/help', '/api/docs/terms', '/api/docs/privacy', '/terms', '/privacy']) {
			const res = await request.get(path, { maxRedirects: 5 });
			const contentType = res.headers()['content-type'] ?? '';
			const body = await res.body();

			// 503 is the route's own "document unavailable" page, which is what an empty bucket
			// produces — a readable page, but still a missing document.
			if (res.status() !== 200 || !contentType.includes('text/html') || body.byteLength < 1000) {
				missing.push(`${path} -> ${res.status()} ${contentType} ${body.byteLength}B`);
			}
		}

		expect(missing, 'documents missing from this environment’s storage bucket').toEqual([]);
	});

	/**
	 * The sandbox policy on those documents is the whole security model for serving them.
	 *
	 * Their contents can be replaced by an upload with no code review, so they are untrusted HTML —
	 * and they are served from our own origin, where a script would run with the reader's session.
	 * The strict policy is applied by a `headers()` rule, and a rule that stops matching fails
	 * silently: the response still has a `Content-Security-Policy`, just the app's permissive one.
	 * That is precisely what happened to `/terms` and `/privacy`, which reach the handler through a
	 * rewrite and so never matched the `/api/docs/:slug` rule. Asserting the header on the wire is
	 * the only check that can tell the two policies apart.
	 */
	test('stored documents are sandboxed and cannot run script', async ({ request }) => {
		const unprotected: string[] = [];

		for (const path of ['/api/docs/help', '/api/docs/terms', '/api/docs/privacy', '/terms', '/privacy']) {
			const res = await request.get(path, { maxRedirects: 5 });
			const csp = res.headers()['content-security-policy'] ?? '';

			if (!csp.includes('sandbox') || !csp.includes("default-src 'none'") || csp.includes("script-src 'self'")) {
				unprotected.push(`${path} -> ${csp || '(no CSP)'}`);
			}
		}

		expect(unprotected, 'documents served without the sandbox policy').toEqual([]);
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
