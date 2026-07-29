import { NextResponse } from 'next/server';

import { checkRateLimit, getClientIdentifier, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * IP-based location fallback for signup.
 *
 * Location is mandatory and has no manual input, so GPS refusal cannot be a dead end. This
 * resolves an approximate (city-level) location from the request IP. Accuracy is lower than
 * GPS, which is the accepted trade for never blocking a signup.
 *
 * Returns 422 rather than 500 when the IP is not publicly routable (localhost, LAN, private
 * ranges) so the client can tell "we cannot know" apart from "something broke".
 */

const UPSTREAM_TIMEOUT_MS = 5000;

export type IpGeocodeResponse = {
	latitude: number | null;
	longitude: number | null;
	city: string;
	state: string;
	zipCode: string;
	country: string;
	approximate: true;
};

/** Client IP, preferring platform-set headers that a client cannot spoof. */
function resolveClientIp(request: Request): string | null {
	const realIp = request.headers.get('x-real-ip');
	if (realIp) {
		return realIp.trim();
	}
	const forwardedFor = request.headers.get('x-forwarded-for');
	if (forwardedFor) {
		const ips = forwardedFor
			.split(',')
			.map(s => s.trim())
			.filter(Boolean);
		// Leftmost is the original client; the rightmost entries are our own proxies.
		return ips[0] ?? null;
	}
	return null;
}

function isPubliclyRoutable(ip: string): boolean {
	if (ip === '::1' || ip === '127.0.0.1' || ip.startsWith('::ffff:127.')) {
		return false;
	}
	// RFC1918 + link-local + CGNAT.
	if (/^10\./.test(ip) || /^192\.168\./.test(ip) || /^169\.254\./.test(ip)) {
		return false;
	}
	if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) {
		return false;
	}
	if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)) {
		return false;
	}
	// IPv6 unique-local.
	if (/^f[cd]/i.test(ip)) {
		return false;
	}
	return true;
}

export async function GET(request: Request) {
	const identifier = getClientIdentifier(request);
	const limit = checkRateLimit(identifier, 'geocode-ip', RATE_LIMITS.api);
	if (!limit.success) {
		return rateLimitResponse(limit);
	}

	const ip = resolveClientIp(request);

	if (!ip || !isPubliclyRoutable(ip)) {
		// Local development and private networks land here — expected, not an error.
		return NextResponse.json(
			{ error: 'Location cannot be determined from this network.' },
			{ status: 422 },
		);
	}

	try {
		const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
			signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
			// Per-IP result; cache briefly to absorb retries without hammering upstream.
			next: { revalidate: 60 * 60 },
		});

		if (!res.ok) {
			throw new Error(`IP geolocation responded ${res.status}`);
		}

		const data = (await res.json()) as {
			success?: boolean;
			latitude?: number;
			longitude?: number;
			city?: string;
			region?: string;
			postal?: string;
			country?: string;
		};

		if (!data.success || !data.city) {
			return NextResponse.json(
				{ error: 'Location cannot be determined from this network.' },
				{ status: 422 },
			);
		}

		const result: IpGeocodeResponse = {
			latitude: typeof data.latitude === 'number' ? data.latitude : null,
			longitude: typeof data.longitude === 'number' ? data.longitude : null,
			city: data.city ?? '',
			state: data.region ?? '',
			zipCode: data.postal ?? '',
			country: data.country ?? '',
			approximate: true,
		};

		return NextResponse.json(result);
	} catch (error) {
		console.error('IP geolocation failed:', error);
		return NextResponse.json({ error: 'Could not determine your location.' }, { status: 502 });
	}
}
