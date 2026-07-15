import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeolocation } from '@/hooks/useGeolocation';

// Mirrors a Nominatim reverse-geocode response body.
function mockNominatim(address: Record<string, string>) {
	global.fetch = vi.fn().mockResolvedValue({
		ok: true,
		json: async () => ({ address }),
	}) as unknown as typeof fetch;
}

function mockGeolocation(coords: { latitude: number; longitude: number } | null) {
	const getCurrentPosition = vi.fn((success: PositionCallback, error?: PositionErrorCallback) => {
		if (coords) {
			success({ coords } as GeolocationPosition);
		} else {
			error?.({ code: 1, message: 'denied' } as GeolocationPositionError);
		}
	});
	vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
	return getCurrentPosition;
}

describe('useGeolocation', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('extracts every address part from the reverse-geocode (not just city)', async () => {
		mockGeolocation({ latitude: 40.1, longitude: -74.2 });
		mockNominatim({
			city: 'Trenton',
			state: 'New Jersey',
			postcode: '08608',
			country: 'United States',
			road: 'Main St',
			house_number: '221',
		});

		const { result } = renderHook(() => useGeolocation());
		let res: Awaited<ReturnType<typeof result.current.locate>> = null;
		await act(async () => {
			res = await result.current.locate();
		});

		expect(res).toEqual({
			latitude: 40.1,
			longitude: -74.2,
			city: 'Trenton',
			state: 'New Jersey',
			zipCode: '08608',
			country: 'United States',
			address: '221 Main St',
		});
	});

	it('falls back through city/town/village and tolerates missing parts', async () => {
		mockGeolocation({ latitude: 1, longitude: 2 });
		mockNominatim({ village: 'Smallville' });

		const { result } = renderHook(() => useGeolocation());
		let res: Awaited<ReturnType<typeof result.current.locate>> = null;
		await act(async () => {
			res = await result.current.locate();
		});

		expect(res).toMatchObject({ city: 'Smallville', state: '', zipCode: '', country: '', address: '' });
	});

	it('resolves null and sets an error when permission is denied', async () => {
		mockGeolocation(null);

		const { result } = renderHook(() => useGeolocation());
		let res: Awaited<ReturnType<typeof result.current.locate>> = null;
		await act(async () => {
			res = await result.current.locate();
		});

		expect(res).toBeNull();
		expect(result.current.error).toBeTruthy();
	});

	it('still returns coordinates when the reverse-geocode request fails', async () => {
		mockGeolocation({ latitude: 5, longitude: 6 });
		global.fetch = vi.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch;

		const { result } = renderHook(() => useGeolocation());
		let res: Awaited<ReturnType<typeof result.current.locate>> = null;
		await act(async () => {
			res = await result.current.locate();
		});

		expect(res).toMatchObject({ latitude: 5, longitude: 6, city: '', country: '' });
	});
});
