/* eslint-env serviceworker */
/* global self, caches, URL */

self.addEventListener('message', event => {
	if (event.data?.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}

	if (event.data?.type === 'CLEAR_RUNTIME_CACHES') {
		event.waitUntil(
			caches.keys().then(cacheNames =>
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
		})(),
	);
});

self.addEventListener('notificationclick', event => {
	const rawUrl = event.notification.data?.url || '/notifications';
	const absoluteUrl = /^https?:\/\//i.test(rawUrl)
		? rawUrl
		: new URL(rawUrl, self.registration.scope).href;

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
