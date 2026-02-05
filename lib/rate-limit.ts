/**
 * Simple in-memory rate limiter.
 * For production, consider using Redis-based rate limiting for distributed environments.
 */

type RateLimitRecord = {
	count: number;
	resetTime: number;
};

// In-memory store for rate limiting
const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up expired entries periodically (every 5 minutes)
setInterval(() => {
	const now = Date.now();
	for (const [key, record] of rateLimitStore.entries()) {
		if (now > record.resetTime) {
			rateLimitStore.delete(key);
		}
	}
}, 5 * 60 * 1000);

export type RateLimitConfig = {
	/** Maximum number of requests allowed within the window */
	maxRequests: number;
	/** Time window in seconds */
	windowSeconds: number;
};

export type RateLimitResult = {
	success: boolean;
	remaining: number;
	resetAt: number;
	retryAfterSeconds?: number;
};

/**
 * Check if a request should be rate limited.
 * @param identifier - Unique identifier for the client (e.g., IP address, user ID)
 * @param endpoint - The endpoint being accessed (used to create unique keys per endpoint)
 * @param config - Rate limit configuration
 * @returns Result indicating if request is allowed and remaining quota
 */
export function checkRateLimit(
	identifier: string,
	endpoint: string,
	config: RateLimitConfig
): RateLimitResult {
	const key = `${endpoint}:${identifier}`;
	const now = Date.now();
	const windowMs = config.windowSeconds * 1000;

	const record = rateLimitStore.get(key);

	// If no record exists or the window has expired, create a new record
	if (!record || now > record.resetTime) {
		const resetTime = now + windowMs;
		rateLimitStore.set(key, { count: 1, resetTime });
		return {
			success: true,
			remaining: config.maxRequests - 1,
			resetAt: resetTime,
		};
	}

	// Check if limit exceeded
	if (record.count >= config.maxRequests) {
		const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
		return {
			success: false,
			remaining: 0,
			resetAt: record.resetTime,
			retryAfterSeconds,
		};
	}

	// Increment the count
	record.count += 1;
	return {
		success: true,
		remaining: config.maxRequests - record.count,
		resetAt: record.resetTime,
	};
}

/**
 * Extract client identifier from request.
 * Uses X-Forwarded-For header if behind proxy, falls back to a default.
 */
export function getClientIdentifier(request: Request, userId?: string): string {
	// Prefer user ID if authenticated
	if (userId) {
		return `user:${userId}`;
	}

	// Try to get IP from headers (for behind proxies like Vercel)
	const forwardedFor = request.headers.get('x-forwarded-for');
	if (forwardedFor) {
		// Take the first IP if multiple are present
		return `ip:${forwardedFor.split(',')[0].trim()}`;
	}

	const realIp = request.headers.get('x-real-ip');
	if (realIp) {
		return `ip:${realIp}`;
	}

	// Fallback - this shouldn't happen in production
	return 'ip:unknown';
}

/**
 * Create a rate limit error response.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
	return Response.json(
		{
			error: 'Too many requests',
			message: `Rate limit exceeded. Please try again in ${result.retryAfterSeconds} seconds.`,
			retryAfter: result.retryAfterSeconds,
		},
		{
			status: 429,
			headers: {
				'Retry-After': String(result.retryAfterSeconds),
				'X-RateLimit-Remaining': String(result.remaining),
				'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
			},
		}
	);
}

// Pre-configured rate limits for different endpoint types
export const RATE_LIMITS = {
	// Auth endpoints - strict limits to prevent brute force
	auth: {
		maxRequests: 5,
		windowSeconds: 60, // 5 requests per minute
	},
	// AI endpoints - moderate limits due to cost
	ai: {
		maxRequests: 20,
		windowSeconds: 60, // 20 requests per minute
	},
	// General API endpoints - more permissive
	api: {
		maxRequests: 100,
		windowSeconds: 60, // 100 requests per minute
	},
} as const;
