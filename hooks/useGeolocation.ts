'use client';

import { useCallback, useState } from 'react';

export interface GeoResult {
	latitude: number | null;
	longitude: number | null;
	city: string;
	state: string;
	zipCode: string;
	country: string;
	address: string;
	/** True when the result came from IP lookup rather than device GPS (city-level accuracy). */
	approximate: boolean;
}

/** Why a locate() attempt produced nothing usable — surfaced so the UI can advise. */
export type GeoFailureReason = 'denied' | 'unsupported' | 'unavailable' | 'network';

const GPS_TIMEOUT_MS = 12000;
const REVERSE_TIMEOUT_MS = 8000;
const IP_TIMEOUT_MS = 8000;

function emptyResult(): GeoResult {
	return {
		latitude: null,
		longitude: null,
		city: '',
		state: '',
		zipCode: '',
		country: '',
		address: '',
		approximate: false,
	};
}

/** fetch with a hard deadline — an unbounded fetch is what used to hang the spinner forever. */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(url, { signal: controller.signal });
	} finally {
		clearTimeout(timer);
	}
}

function getBrowserPosition(): Promise<GeolocationPosition | GeoFailureReason> {
	return new Promise(resolve => {
		if (typeof navigator === 'undefined' || !navigator.geolocation) {
			resolve('unsupported');
			return;
		}

		navigator.geolocation.getCurrentPosition(
			position => resolve(position),
			err => {
				// PERMISSION_DENIED is also what a Permissions-Policy block reports, so we cannot
				// distinguish "user said no" from "the header forbids it" here.
				resolve(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
			},
			{ timeout: GPS_TIMEOUT_MS, enableHighAccuracy: false, maximumAge: 5 * 60 * 1000 },
		);
	});
}

/**
 * Resolves the user's location, GPS first with an IP-based fallback.
 *
 * Reverse geocoding goes through `/api/geocode/reverse` rather than calling Nominatim from
 * the browser: the direct call was blocked by our CSP and the failure was swallowed, so
 * signup showed "Location captured" with every address field empty.
 */
export function useGeolocation() {
	const [isLocating, setIsLocating] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [failureReason, setFailureReason] = useState<GeoFailureReason | null>(null);

	const locate = useCallback(async (): Promise<GeoResult | null> => {
		setIsLocating(true);
		setError(null);
		setFailureReason(null);

		try {
			const position = await getBrowserPosition();

			if (typeof position !== 'string') {
				const { latitude, longitude } = position.coords;
				const result = { ...emptyResult(), latitude, longitude };

				try {
					const res = await fetchWithTimeout(
						`/api/geocode/reverse?lat=${latitude}&lon=${longitude}`,
						REVERSE_TIMEOUT_MS,
					);
					if (res.ok) {
						const data = (await res.json()) as Partial<GeoResult>;
						result.city = data.city ?? '';
						result.state = data.state ?? '';
						result.zipCode = data.zipCode ?? '';
						result.country = data.country ?? '';
						result.address = data.address ?? '';
					}
				} catch {
					// Fall through — coordinates alone are not enough for a mandatory location,
					// so the IP fallback below still gets a chance to name the place.
				}

				if (result.city) {
					return result;
				}

				// We have coordinates but no place name. Try IP so the user still ends up with a
				// city rather than a silently-empty address.
				const viaIp = await locateViaIp();
				if (viaIp?.city) {
					return { ...viaIp, latitude, longitude, approximate: false };
				}

				setFailureReason('network');
				setError('We found your position but could not look up your city. Please try again.');
				return null;
			}

			// GPS refused or unavailable — fall back to IP so signup is never a dead end.
			const viaIp = await locateViaIp();
			if (viaIp?.city) {
				return viaIp;
			}

			setFailureReason(position);
			setError(
				position === 'denied'
					? 'Location permission is blocked. Enable location for this site in your browser settings, then try again.'
					: position === 'unsupported'
						? 'Your browser does not support location detection. Please try a different browser.'
						: 'We could not determine your location. Check your connection and try again.',
			);
			return null;
		} finally {
			setIsLocating(false);
		}
	}, []);

	return { locate, isLocating, error, failureReason };
}

async function locateViaIp(): Promise<GeoResult | null> {
	try {
		const res = await fetchWithTimeout('/api/geocode/ip', IP_TIMEOUT_MS);
		if (!res.ok) {
			return null;
		}
		const data = (await res.json()) as Partial<GeoResult>;
		if (!data.city) {
			return null;
		}
		return {
			...emptyResult(),
			latitude: data.latitude ?? null,
			longitude: data.longitude ?? null,
			city: data.city,
			state: data.state ?? '',
			zipCode: data.zipCode ?? '',
			country: data.country ?? '',
			approximate: true,
		};
	} catch {
		return null;
	}
}
