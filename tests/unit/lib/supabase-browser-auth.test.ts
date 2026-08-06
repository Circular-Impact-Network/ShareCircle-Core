import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ensureRealtimeAuth, resetBrowserSupabaseClient } from '@/lib/supabaseBrowser';

type FakeClient = { realtime: { setAuth: ReturnType<typeof vi.fn> } };

function fakeClient(): FakeClient {
	return { realtime: { setAuth: vi.fn().mockResolvedValue(undefined) } };
}

/**
 * The failure path matters more than the success path here. Clearing the cached promise on every
 * failure meant the next subscriber retried immediately, and there are several subscribers per
 * authenticated page — so a persistently failing token endpoint produced a burst of doomed
 * requests on every page load, against the server that was already failing.
 */
describe('ensureRealtimeAuth', () => {
	const originalFetch = global.fetch;

	beforeEach(() => {
		resetBrowserSupabaseClient();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		global.fetch = originalFetch;
		resetBrowserSupabaseClient();
	});

	it('fetches once and shares the result with concurrent subscribers', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ token: 'tok', expiresAt: Date.now() + 3_600_000 }),
		});
		global.fetch = fetchMock as unknown as typeof fetch;
		const client = fakeClient();

		await Promise.all([
			ensureRealtimeAuth(client as never),
			ensureRealtimeAuth(client as never),
			ensureRealtimeAuth(client as never),
		]);

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(client.realtime.setAuth).toHaveBeenCalledWith('tok');
	});

	it('does not retry on every subsequent call after a failure', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
		global.fetch = fetchMock as unknown as typeof fetch;
		const client = fakeClient();

		await expect(ensureRealtimeAuth(client as never)).rejects.toThrow();
		// Three more subscribers mounting — none of them should hit the endpoint again.
		await expect(ensureRealtimeAuth(client as never)).rejects.toThrow();
		await expect(ensureRealtimeAuth(client as never)).rejects.toThrow();
		await expect(ensureRealtimeAuth(client as never)).rejects.toThrow();

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('allows a retry once the cooldown has elapsed', async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
		global.fetch = fetchMock as unknown as typeof fetch;
		const client = fakeClient();

		await expect(ensureRealtimeAuth(client as never)).rejects.toThrow();
		expect(fetchMock).toHaveBeenCalledTimes(1);

		vi.setSystemTime(Date.now() + 31_000);

		await expect(ensureRealtimeAuth(client as never)).rejects.toThrow();
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});
