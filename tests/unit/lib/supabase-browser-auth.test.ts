import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ClientOptions = { accessToken?: () => Promise<string> };

const createClientMock = vi.fn((_url: string, _key: string, _options?: ClientOptions) => ({
	realtime: { setAuth: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@supabase/supabase-js', () => ({ createClient: createClientMock }));

const ANON_KEY = 'anon-key-that-must-never-reach-the-socket';

async function loadModule() {
	vi.resetModules();
	vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
	vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', ANON_KEY);
	return import('@/lib/supabaseBrowser');
}

/** The `accessToken` provider handed to createClient — the only route a token takes to the socket. */
function tokenProvider(): () => Promise<string> {
	const options = createClientMock.mock.calls.at(-1)?.[2];
	if (!options?.accessToken) throw new Error('createClient was not given an accessToken provider');
	return options.accessToken;
}

function okResponse(token: string, ttlMs = 3_600_000) {
	return { ok: true, json: async () => ({ token, expiresAt: Date.now() + ttlMs }) };
}

describe('browser realtime auth', () => {
	const originalFetch = global.fetch;

	beforeEach(() => {
		createClientMock.mockClear();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllEnvs();
		global.fetch = originalFetch;
	});

	/**
	 * The regression this file exists for.
	 *
	 * supabase-js re-authorises the socket inside `connect()` — so on every reconnect — using the
	 * provider it was constructed with. Previously we called `realtime.setAuth()` after the fact
	 * and left that provider as the default, which resolves a GoTrue session; this app has none, so
	 * it fell back to the anon key. Channels then rejoined as `anon`, every private topic was
	 * refused, and live messages and notifications stopped arriving.
	 */
	it('gives supabase-js a token provider so the anon key can never reach the socket', async () => {
		const mod = await loadModule();
		global.fetch = vi.fn().mockResolvedValue(okResponse('minted-jwt')) as unknown as typeof fetch;

		mod.createBrowserSupabaseClient();

		const token = await tokenProvider()();
		expect(token).toBe('minted-jwt');
		expect(token).not.toBe(ANON_KEY);
	});

	it('throws rather than degrading to the anon key when the endpoint fails', async () => {
		const mod = await loadModule();
		global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

		mod.createBrowserSupabaseClient();

		await expect(tokenProvider()()).rejects.toThrow(/Realtime token request failed: 500/);
	});

	it('fetches once and shares the result with concurrent subscribers', async () => {
		const mod = await loadModule();
		const fetchMock = vi.fn().mockResolvedValue(okResponse('tok'));
		global.fetch = fetchMock as unknown as typeof fetch;

		await Promise.all([
			mod.ensureRealtimeAuth(null as never),
			mod.ensureRealtimeAuth(null as never),
			mod.ensureRealtimeAuth(null as never),
		]);

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('reuses the cached token until it nears expiry, then refetches', async () => {
		const mod = await loadModule();
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(okResponse('first', 10 * 60_000))
			.mockResolvedValueOnce(okResponse('second', 10 * 60_000));
		global.fetch = fetchMock as unknown as typeof fetch;
		mod.createBrowserSupabaseClient();
		const provider = tokenProvider();

		expect(await provider()).toBe('first');
		expect(await provider()).toBe('first');
		expect(fetchMock).toHaveBeenCalledTimes(1);

		// Inside the 5-minute refresh margin, so the cached token is no longer good enough.
		vi.setSystemTime(Date.now() + 6 * 60_000);
		expect(await provider()).toBe('second');
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	/**
	 * A failing endpoint used to produce a burst of doomed requests: there are several subscribers
	 * per authenticated page, and the socket asks again on every reconnect.
	 */
	it('does not retry on every subsequent call after a failure', async () => {
		const mod = await loadModule();
		const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
		global.fetch = fetchMock as unknown as typeof fetch;

		for (let i = 0; i < 4; i++) {
			await expect(mod.ensureRealtimeAuth(null as never)).rejects.toThrow();
		}

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('allows a retry once the cooldown has elapsed', async () => {
		const mod = await loadModule();
		const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
		global.fetch = fetchMock as unknown as typeof fetch;

		await expect(mod.ensureRealtimeAuth(null as never)).rejects.toThrow();
		expect(fetchMock).toHaveBeenCalledTimes(1);

		vi.setSystemTime(Date.now() + 31_000);

		await expect(mod.ensureRealtimeAuth(null as never)).rejects.toThrow();
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	/**
	 * Subscribing without a status callback swallows CHANNEL_ERROR, which is exactly how a socket
	 * being refused every topic looked identical to a healthy one.
	 */
	it('reports channel errors instead of failing silently', async () => {
		const mod = await loadModule();
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const report = mod.reportSubscription('notifications:u1');

		report('SUBSCRIBED');
		expect(error).not.toHaveBeenCalled();
		expect(warn).not.toHaveBeenCalled();

		// Supabase refuses the first private join while the tenant's database connection is still
		// being established, and Phoenix rejoins ~2s later. Escalating that would put a screenful
		// of red on every page load and bury the failures that matter.
		report('CHANNEL_ERROR', new Error('Unauthorized'));
		expect(error).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('notifications:u1'));

		report('CHANNEL_ERROR', new Error('Unauthorized'));
		expect(error).toHaveBeenCalledWith(expect.stringContaining('Unauthorized'));

		// A successful join clears the streak, so a later blip is treated as a first failure again.
		report('SUBSCRIBED');
		error.mockClear();
		warn.mockClear();
		report('CHANNEL_ERROR', new Error('blip'));
		expect(error).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalledOnce();

		error.mockRestore();
		warn.mockRestore();
	});
});
