import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

/**
 * The Fingerprint agent depends on two files that say nothing about Fingerprint on their face, and it
 * fails misleadingly when either drifts.
 *
 * The service worker was the expensive one to find. Letting Workbox handle the agent's hosts breaks
 * identification with "Failed to load the JS script of the agent" and **no CSP violation**, so the
 * obvious suspect is the innocent one. Routing them to NetworkOnly was worse than leaving them to the
 * default strategy: it also killed the GET that had been succeeding. The only thing that works is not
 * handling them at all, which is what the listener in sw-extra.js does by stopping propagation
 * without responding, leaving the browser to fetch natively.
 *
 * These execute the real listener rather than grepping for a string, because the thing that matters
 * is that `respondWith` is never called for those hosts.
 */
const ROOT = process.cwd();
const SW_EXTRA = readFileSync(path.join(ROOT, 'public/sw-extra.js'), 'utf8');
const NEXT_CONFIG = readFileSync(path.join(ROOT, 'next.config.ts'), 'utf8');

type Listener = (event: unknown) => unknown;

function loadServiceWorkerListeners(): Record<string, Listener[]> {
	const listeners: Record<string, Listener[]> = {};
	const fakeSelf = {
		addEventListener: (type: string, fn: Listener) => {
			listeners[type] = [...(listeners[type] ?? []), fn];
		},
		skipWaiting: () => {},
		registration: { showNotification: () => Promise.resolve() },
		clients: { matchAll: () => Promise.resolve([]), openWindow: () => Promise.resolve(null) },
	};
	new Function('self', 'caches', 'URL', SW_EXTRA)(
		fakeSelf,
		{ keys: () => Promise.resolve([]), delete: () => Promise.resolve(true) },
		URL,
	);
	return listeners;
}

function dispatchFetch(url: string) {
	const listeners = loadServiceWorkerListeners()['fetch'] ?? [];
	const event = {
		request: { url },
		stopImmediatePropagation: vi.fn(),
		respondWith: vi.fn(),
	};
	for (const listener of listeners) {
		listener(event);
	}
	return event;
}

describe('the service worker leaves Fingerprint alone', () => {
	it('registers a fetch listener at all', () => {
		expect(loadServiceWorkerListeners()['fetch']?.length ?? 0).toBeGreaterThan(0);
	});

	for (const url of [
		'https://api.fpjs.io/?ci=js/4.1.4&q=key',
		'https://eu.api.fpjs.io/',
		'https://fpnpmcdn.net/v4/key?ci=jsl/4.1.3',
	]) {
		it(`hands ${new URL(url).hostname} to the browser instead of Workbox`, () => {
			const event = dispatchFetch(url);

			expect(event.stopImmediatePropagation).toHaveBeenCalled();
			// Responding at all — even with NetworkOnly — is what broke identification.
			expect(event.respondWith).not.toHaveBeenCalled();
		});
	}

	it('leaves our own requests to Workbox, so page and API caching still apply', () => {
		const event = dispatchFetch('https://sharecircle.example/api/items');

		expect(event.stopImmediatePropagation).not.toHaveBeenCalled();
		expect(event.respondWith).not.toHaveBeenCalled();
	});

	it('is not fooled by a hostname that merely ends with the same letters', () => {
		const event = dispatchFetch('https://notfpjs.io/steal');

		expect(event.stopImmediatePropagation).not.toHaveBeenCalled();
	});

	it('keeps the agent out of the Workbox route list, where any strategy breaks it', () => {
		const runtimeCaching = NEXT_CONFIG.slice(
			NEXT_CONFIG.indexOf('runtimeCaching: ['),
			NEXT_CONFIG.indexOf('const isDev'),
		);
		const rules = runtimeCaching.split('urlPattern').slice(1);
		const offenders = rules.filter(rule => /fpjs|fpnpmcdn/.test(rule.split('handler')[0] ?? ''));

		expect(offenders, 'a Workbox route now matches Fingerprint again').toHaveLength(0);
	});
});
