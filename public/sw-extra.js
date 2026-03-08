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

	const payload = event.data.json();

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
				return;
			}

			await self.registration.showNotification(payload.title, {
				body: payload.body,
				tag: payload.tag || 'sharecircle-notification',
				data: {
					url: payload.url || '/notifications',
					...(payload.data || {}),
				},
			});
		})(),
	);
});

self.addEventListener('notificationclick', event => {
	const targetUrl = event.notification.data?.url || '/notifications';

	event.notification.close();
	event.waitUntil(
		(async () => {
			const windowClients = await self.clients.matchAll({
				type: 'window',
				includeUncontrolled: true,
			});

			for (const client of windowClients) {
				const clientUrl = new URL(client.url);
				if (clientUrl.pathname === targetUrl) {
					await client.focus();
					return;
				}
			}

			await self.clients.openWindow(targetUrl);
		})(),
	);
});
