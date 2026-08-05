import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeolocation } from '@/hooks/useGeolocation';

/**
 * The hook talks to our own proxy routes, not Nominatim directly — the direct call was
 * blocked by CSP and the failure was swallowed, leaving signup showing "Location captured"
 * with every address field empty.
 *
 * Routes a mocked fetch by URL so a test can make GPS reverse-geocoding and the IP fallback
 * behave independently.
 */
function mockRoutes(handlers: {
	reverse?: { ok: boolean; body?: unknown } | 'reject' | 'hang';
	ip?: { ok: boolean; body?: unknown } | 'reject';
}) {
	global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);

		if (url.includes('/api/geocode/reverse')) {
			const h = handlers.reverse;
			if (!h) return Promise.resolve({ ok: false, json: async () => ({}) });
			if (h === 'reject') return Promise.reject(new Error('network'));
			if (h === 'hang') {
				// Settles only on abort, like real fetch. A mock that ignores the signal would
				// hang the test runner instead of exercising the hook's deadline.
				return new Promise((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')));
				});
			}
			return Promise.resolve({ ok: h.ok, json: async () => h.body ?? {} });
		}

		if (url.includes('/api/geocode/ip')) {
			const h = handlers.ip;
			if (!h) return Promise.resolve({ ok: false, json: async () => ({}) });
			if (h === 'reject') return Promise.reject(new Error('network'));
			return Promise.resolve({ ok: h.ok, json: async () => h.body ?? {} });
		}

		return Promise.reject(new Error(`Unexpected fetch: ${url}`));
	}) as unknown as typeof fetch;
}

/** `deny` mirrors both a user refusal and a Permissions-Policy block — both report code 1. */
function mockGeolocation(coords: { latitude: number; longitude: number } | 'deny' | 'unavailable' | 'unsupported') {
	if (coords === 'unsupported') {
		vi.stubGlobal('navigator', {});
		return;
	}

	const getCurrentPosition = vi.fn((success: PositionCallback, error?: PositionErrorCallback) => {
		if (typeof coords === 'object') {
			success({ coords } as GeolocationPosition);
			return;
		}
		error?.({
			code: coords === 'deny' ? 1 : 2,
			PERMISSION_DENIED: 1,
			POSITION_UNAVAILABLE: 2,
			TIMEOUT: 3,
			message: coords,
		} as GeolocationPositionError);
	});
	vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
}

describe('useGeolocation', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	async function locate() {
		const { result } = renderHook(() => useGeolocation());
		let res: Awaited<ReturnType<typeof result.current.locate>> = null;
		await act(async () => {
			res = await result.current.locate();
		});
		return { res, result };
	}

	it('extracts every address part from the reverse-geocode (not just city)', async () => {
		mockGeolocation({ latitude: 40.1, longitude: -74.2 });
		mockRoutes({
			reverse: {
				ok: true,
				body: {
					city: 'Trenton',
					state: 'New Jersey',
					zipCode: '08608',
					country: 'United States',
					address: '221 Main St',
				},
			},
		});

		const { res } = await locate();

		expect(res).toEqual({
			latitude: 40.1,
			longitude: -74.2,
			city: 'Trenton',
			state: 'New Jersey',
			zipCode: '08608',
			country: 'United States',
			address: '221 Main St',
			approximate: false,
		});
	});

	it('tolerates a partial address as long as a city is resolved', async () => {
		mockGeolocation({ latitude: 1, longitude: 2 });
		mockRoutes({ reverse: { ok: true, body: { city: 'Smallville' } } });

		const { res } = await locate();

		expect(res).toMatchObject({ city: 'Smallville', state: '', zipCode: '', country: '', address: '' });
	});

	it('falls back to IP lookup when the browser denies permission', async () => {
		mockGeolocation('deny');
		mockRoutes({ ip: { ok: true, body: { city: 'Berlin', state: 'Berlin', country: 'Germany' } } });

		const { res, result } = await locate();

		// The whole point of the fallback: a refusal must not be a dead end, because location
		// is mandatory at signup and there is no manual input.
		expect(res).toMatchObject({ city: 'Berlin', country: 'Germany', approximate: true });
		expect(result.current.error).toBeNull();
	});

	it('reports a denied permission when IP lookup also fails', async () => {
		mockGeolocation('deny');
		mockRoutes({ ip: { ok: false } });

		const { res, result } = await locate();

		expect(res).toBeNull();
		expect(result.current.failureReason).toBe('denied');
		// Must name the actual cause so the user knows to unblock the browser permission.
		expect(result.current.error).toMatch(/permission/i);
	});

	it('reports unsupported when the browser has no geolocation API', async () => {
		mockGeolocation('unsupported');
		mockRoutes({ ip: { ok: false } });

		const { res, result } = await locate();

		expect(res).toBeNull();
		expect(result.current.failureReason).toBe('unsupported');
	});

	it('falls back to IP when coordinates resolve but reverse-geocoding fails', async () => {
		mockGeolocation({ latitude: 5, longitude: 6 });
		mockRoutes({ reverse: 'reject', ip: { ok: true, body: { city: 'Mumbai', country: 'India' } } });

		const { res } = await locate();

		// Coordinates from GPS are kept (they're precise); only the place name comes from IP,
		// so this is not flagged approximate.
		expect(res).toMatchObject({ latitude: 5, longitude: 6, city: 'Mumbai', approximate: false });
	});

	it('never resolves with a coordinates-only result', async () => {
		mockGeolocation({ latitude: 5, longitude: 6 });
		mockRoutes({ reverse: { ok: false }, ip: { ok: false } });

		const { res, result } = await locate();

		// Previously the hook returned coordinates with empty city/state/country and the UI
		// happily reported "Location captured" — a silent data-quality failure.
		expect(res).toBeNull();
		expect(result.current.error).toBeTruthy();
	});

	it('does not hang forever when the reverse-geocode request never settles', async () => {
		vi.useFakeTimers();
		mockGeolocation({ latitude: 5, longitude: 6 });
		mockRoutes({ reverse: 'hang', ip: { ok: true, body: { city: 'Lisbon' } } });

		const { result } = renderHook(() => useGeolocation());
		let res: Awaited<ReturnType<typeof result.current.locate>> = null;

		// A stalled fetch used to leave the promise unresolved and isLocating stuck true, so
		// the pin button span forever with no way out. The AbortController deadline must fire
		// and let the IP fallback finish the job.
		await act(async () => {
			const pending = result.current.locate().then(value => {
				res = value;
			});
			// Past the hook's 8s reverse-geocode deadline.
			await vi.advanceTimersByTimeAsync(9000);
			await pending;
		});

		expect(res).toMatchObject({ city: 'Lisbon' });
		expect(result.current.isLocating).toBe(false);
	});
});
