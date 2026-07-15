'use client';

import { useCallback, useState } from 'react';

export interface GeoResult {
	latitude: number;
	longitude: number;
	city: string;
	state: string;
	zipCode: string;
	country: string;
	address: string;
}

/**
 * Browser geolocation + Nominatim reverse-geocode, shared by signup and complete-profile.
 * Returns all address parts (previously only `city` was extracted and the rest discarded).
 * Resolves null on permission denial / unsupported so callers can fall back to manual entry.
 */
export function useGeolocation() {
	const [isLocating, setIsLocating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const locate = useCallback((): Promise<GeoResult | null> => {
		return new Promise(resolve => {
			if (typeof navigator === 'undefined' || !navigator.geolocation) {
				setError('Geolocation is not supported by your browser.');
				resolve(null);
				return;
			}
			setError(null);
			setIsLocating(true);
			navigator.geolocation.getCurrentPosition(
				async position => {
					const { latitude, longitude } = position.coords;
					const result: GeoResult = {
						latitude,
						longitude,
						city: '',
						state: '',
						zipCode: '',
						country: '',
						address: '',
					};
					try {
						const res = await fetch(
							`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
						);
						if (res.ok) {
							const data = await res.json();
							const a = data.address ?? {};
							result.city = a.city || a.town || a.village || a.county || '';
							result.state = a.state || '';
							result.zipCode = a.postcode || '';
							result.country = a.country || '';
							result.address = [a.house_number, a.road].filter(Boolean).join(' ');
						}
					} catch {
						// Ignore reverse-geocode failures; coordinates are still captured.
					}
					setIsLocating(false);
					resolve(result);
				},
				() => {
					setError('Unable to retrieve your location. You can enter your details manually.');
					setIsLocating(false);
					resolve(null);
				},
				{ timeout: 8000 },
			);
		});
	}, []);

	return { locate, isLocating, error };
}
