/* eslint-env serviceworker */
/* global self, caches, URL */

/**
 * Keep the Fingerprint device-intelligence agent out of the service worker entirely.
 *
 * The agent fetches its bundle from fpnpmcdn.net and identifies against api.fpjs.io, and any Workbox
 * involvement breaks it: with the default cross-origin strategy the POST identification call came
 * back ERR_ABORTED and the agent script ERR_FAILED ("Failed to load the JS script of the agent"), and
 * routing those hosts to NetworkOnly was worse — it also killed the GET that had been succeeding.
 * Blocking service workers in the browser made all three requests return 200, which is what pinned
 * the cause here rather than on CSP, where there was no violation to find.
 *
 * Not calling respondWith is the point: stopping propagation leaves the request entirely unhandled,
 * so the browser performs its own native fetch. This listener is registered while sw-extra.js is
 * imported, which happens before Workbox registers any route, so it runs first and Workbox never
 * sees these requests.
 *
 * Consequence to keep in mind: these requests are invisible to the service worker, so they are never
 * cached and never available offline. That is correct for identification, which is worthless stale.
 */
self.addEventListener('fetch', event => {
	let hostname;
	try {
		hostname = new URL(event.request.url).hostname;
	} catch {
		return;
	}

	if (/(^|\.)fpjs\.io$|(^|\.)fpnpmcdn\.net$/.test(hostname)) {
		event.stopImmediatePropagation();
	}
});

self.addEventListener('message', event => {
	if (event.data?.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}

	if (event.data?.type === 'CLEAR_RUNTIME_CACHES') {
		event.waitUntil(
			caches
				.keys()
				.then(cacheNames =>
					Promise.all(
						cacheNames
							.filter(cacheName => !cacheName.includes('precache'))
							.map(cacheName => caches.delete(cacheName)),
					),
				),
		);
	}
});

self.addEventListener('push', event => {
	if (!event.data) {
		return;
	}

	let payload;
	try {
		payload = event.data.json();
	} catch {
		return;
	}

	const title = typeof payload.title === 'string' && payload.title.trim() ? payload.title : 'ShareCircle';
	const body = typeof payload.body === 'string' ? payload.body : '';
	const openPath = typeof payload.url === 'string' && payload.url.trim() ? payload.url : '/notifications';

	event.waitUntil(
		(async () => {
			const windowClients = await self.clients.matchAll({
				type: 'window',
				includeUncontrolled: true,
			});

			const visibleClient = windowClients.find(client => client.visibilityState === 'visible');
			if (visibleClient) {
				visibleClient.postMessage({
					type: 'SC_PUSH_EVENT',
					payload,
				});
			}

			// Always show a system notification. Previously we returned early when a window
			// was visible, so the PWA open on a phone never surfaced pushes in the OS tray.
			await self.registration.showNotification(title, {
				body,
				tag: payload.tag || 'sharecircle-notification',
				icon: '/icon',
				badge: '/icon',
				data: {
					url: openPath,
					...(payload.data && typeof payload.data === 'object' ? payload.data : {}),
				},
			});

			const receivedAt = new Date().toISOString();
			const debugTag = typeof payload.tag === 'string' ? payload.tag : null;
			for (const client of windowClients) {
				client.postMessage({
					type: 'SC_PUSH_DEBUG',
					receivedAt,
					tag: debugTag,
				});
			}
		})(),
	);
});

self.addEventListener('pushsubscriptionchange', event => {
	event.waitUntil(
		(async () => {
			const newSubscription = await self.registration.pushManager.subscribe(
				event.oldSubscription?.options ?? { userVisibleOnly: true },
			);
			await fetch('/api/push/subscriptions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					endpoint: newSubscription.endpoint,
					expirationTime: newSubscription.expirationTime,
					keys: {
						p256dh: btoa(String.fromCharCode(...new Uint8Array(newSubscription.getKey('p256dh')))),
						auth: btoa(String.fromCharCode(...new Uint8Array(newSubscription.getKey('auth')))),
					},
				}),
			});
		})(),
	);
});

self.addEventListener('notificationclick', event => {
	const rawUrl = event.notification.data?.url || '/notifications';
	const absoluteUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : new URL(rawUrl, self.registration.scope).href;

	event.notification.close();
	event.waitUntil(
		(async () => {
			const windowClients = await self.clients.matchAll({
				type: 'window',
				includeUncontrolled: true,
			});

			const targetPath = new URL(absoluteUrl).pathname;

			for (const client of windowClients) {
				const clientUrl = new URL(client.url);
				if (clientUrl.pathname === targetPath) {
					await client.focus();
					return;
				}
			}

			await self.clients.openWindow(absoluteUrl);
		})(),
	);
});
