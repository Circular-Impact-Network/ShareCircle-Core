import { NextResponse } from 'next/server';
import { z } from 'zod';

import { checkRateLimit, getClientIdentifier, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * Server-side reverse geocoding proxy.
 *
 * The browser used to call nominatim.openstreetmap.org directly, which the CSP
 * `connect-src` blocked — and the failure was swallowed, so signup reported "Location
 * captured" while city/state/country were all empty. Proxying keeps `connect-src 'self'`
 * intact, lets us send the identifying User-Agent Nominatim's usage policy requires, and
 * gives us one place to cache and rate limit.
 *
 * Public (used during signup, before a session exists), so it is rate limited by IP.
 */

const querySchema = z.object({
	lat: z.coerce.number().min(-90).max(90),
	lon: z.coerce.number().min(-180).max(180),
});

const CONTACT = process.env.GEOCODE_CONTACT_EMAIL || 'support@sharecircle.app';
const UPSTREAM_TIMEOUT_MS = 6000;

export type ReverseGeocodeResponse = {
	city: string;
	state: string;
	zipCode: string;
	country: string;
	address: string;
};

export async function GET(request: Request) {
	const identifier = getClientIdentifier(request);
	const limit = checkRateLimit(identifier, 'geocode-reverse', RATE_LIMITS.api);
	if (!limit.success) {
		return rateLimitResponse(limit);
	}

	const { searchParams } = new URL(request.url);
	const parsed = querySchema.safeParse({
		lat: searchParams.get('lat'),
		lon: searchParams.get('lon'),
	});

	if (!parsed.success) {
		return NextResponse.json({ error: 'Valid lat and lon are required.' }, { status: 400 });
	}

	const { lat, lon } = parsed.data;

	try {
		const url = new URL('https://nominatim.openstreetmap.org/reverse');
		url.searchParams.set('lat', String(lat));
		url.searchParams.set('lon', String(lon));
		url.searchParams.set('format', 'json');
		url.searchParams.set('addressdetails', '1');
		// Default zoom (18) on purpose: at zoom=14 Nominatim omits postcode and state, and we
		// persist both. Verified — zoom=14 returned Berlin with an empty state and zipCode.

		const res = await fetch(url, {
			headers: {
				// Nominatim's usage policy requires an identifying UA with contact details;
				// keyless browser traffic without one gets 403/429'd.
				'User-Agent': `ShareCircle/1.0 (${CONTACT})`,
				'Accept-Language': request.headers.get('accept-language') || 'en',
			},
			signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
			next: { revalidate: 60 * 60 * 24 },
		});

		if (!res.ok) {
			throw new Error(`Nominatim responded ${res.status}`);
		}

		const data = (await res.json()) as { address?: Record<string, string> };
		const a = data.address ?? {};

		const result: ReverseGeocodeResponse = {
			city: a.city || a.town || a.village || a.municipality || a.county || '',
			state: a.state || a.region || '',
			zipCode: a.postcode || '',
			country: a.country || '',
			address: [a.house_number, a.road].filter(Boolean).join(' '),
		};

		return NextResponse.json(result);
	} catch (error) {
		console.error('Reverse geocode failed:', error);
		return NextResponse.json({ error: 'Could not resolve that location.' }, { status: 502 });
	}
}
