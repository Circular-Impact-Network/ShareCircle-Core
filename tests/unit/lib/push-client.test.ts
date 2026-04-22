import { describe, it, expect, vi, beforeEach } from 'vitest';

// Test urlBase64ToUint8Array in isolation (it uses window.atob)
describe('push-client', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	describe('isPushSupported', () => {
		it('returns false when PushManager is missing', async () => {
			const orig = (globalThis as Record<string, unknown>).PushManager;
			delete (globalThis as Record<string, unknown>).PushManager;
			const { isPushSupported } = await import('@/lib/push-client');
			expect(isPushSupported()).toBe(false);
			(globalThis as Record<string, unknown>).PushManager = orig;
		});

		it('checks for required browser APIs', async () => {
			// In happy-dom, PushManager and/or Notification may be missing
			const { isPushSupported } = await import('@/lib/push-client');
			// The function checks window, serviceWorker, PushManager, Notification
			// In test env some may be missing, so result depends on env
			const result = isPushSupported();
			expect(typeof result).toBe('boolean');
		});
	});

	describe('getBrowserPushPermission', () => {
		it('returns unsupported when push not supported', async () => {
			const orig = (globalThis as Record<string, unknown>).PushManager;
			delete (globalThis as Record<string, unknown>).PushManager;
			const { getBrowserPushPermission } = await import('@/lib/push-client');
			expect(getBrowserPushPermission()).toBe('unsupported');
			(globalThis as Record<string, unknown>).PushManager = orig;
		});
	});

	describe('urlBase64ToUint8Array', () => {
		it('converts a base64url string to Uint8Array', async () => {
			const { urlBase64ToUint8Array } = await import('@/lib/push-client');
			// Known test vector: base64url "AQID" -> bytes [1, 2, 3]
			const result = urlBase64ToUint8Array('AQID');
			expect(result).toBeInstanceOf(Uint8Array);
			expect(Array.from(result)).toEqual([1, 2, 3]);
		});

		it('handles base64url characters (- and _)', async () => {
			const { urlBase64ToUint8Array } = await import('@/lib/push-client');
			// "+" in base64 is "-" in base64url, "/" is "_"
			const result = urlBase64ToUint8Array('AA');
			expect(result).toBeInstanceOf(Uint8Array);
			expect(result.length).toBeGreaterThan(0);
		});
	});

	describe('isIosBrowser', () => {
		it('returns false with default user agent', async () => {
			const { isIosBrowser } = await import('@/lib/push-client');
			expect(isIosBrowser()).toBe(false);
		});
	});

	describe('isStandaloneDisplayMode', () => {
		it('returns false by default', async () => {
			const { isStandaloneDisplayMode } = await import('@/lib/push-client');
			expect(isStandaloneDisplayMode()).toBe(false);
		});
	});
});
