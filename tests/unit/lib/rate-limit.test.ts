/**
 * Unit tests for rate limiting functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

describe('Rate Limiting', () => {
	beforeEach(() => {
		// Clear any state between tests by waiting a bit
		// In a real implementation with Redis, we'd clear the store
	});

	describe('checkRateLimit', () => {
		it('allows requests within the limit', () => {
			const identifier = 'test-user-1';
			const endpoint = 'test-endpoint';
			const config = { maxRequests: 5, windowSeconds: 60 };

			// Make 5 requests - all should succeed
			for (let i = 0; i < 5; i++) {
				const result = checkRateLimit(identifier, endpoint, config);
				expect(result.success).toBe(true);
				expect(result.remaining).toBe(5 - i - 1);
			}
		});

		it('blocks requests exceeding the limit', () => {
			const identifier = 'test-user-2';
			const endpoint = 'test-endpoint-2';
			const config = { maxRequests: 3, windowSeconds: 60 };

			// Make 3 requests - all should succeed
			for (let i = 0; i < 3; i++) {
				const result = checkRateLimit(identifier, endpoint, config);
				expect(result.success).toBe(true);
			}

			// 4th request should be blocked
			const result = checkRateLimit(identifier, endpoint, config);
			expect(result.success).toBe(false);
			expect(result.remaining).toBe(0);
			expect(result.retryAfterSeconds).toBeDefined();
			expect(result.retryAfterSeconds!).toBeGreaterThan(0);
		});

		it('tracks different endpoints separately', () => {
			const identifier = 'test-user-3';
			const config = { maxRequests: 2, windowSeconds: 60 };

			// Use up limit for endpoint 1
			checkRateLimit(identifier, 'endpoint-1', config);
			checkRateLimit(identifier, 'endpoint-1', config);

			// Endpoint 1 should be blocked
			const result1 = checkRateLimit(identifier, 'endpoint-1', config);
			expect(result1.success).toBe(false);

			// Endpoint 2 should still work
			const result2 = checkRateLimit(identifier, 'endpoint-2', config);
			expect(result2.success).toBe(true);
		});

		it('tracks different identifiers separately', () => {
			const endpoint = 'test-endpoint-3';
			const config = { maxRequests: 2, windowSeconds: 60 };

			// Use up limit for user 1
			checkRateLimit('user-1', endpoint, config);
			checkRateLimit('user-1', endpoint, config);

			// User 1 should be blocked
			const result1 = checkRateLimit('user-1', endpoint, config);
			expect(result1.success).toBe(false);

			// User 2 should still work
			const result2 = checkRateLimit('user-2', endpoint, config);
			expect(result2.success).toBe(true);
		});

		it('returns correct reset time', () => {
			const identifier = 'test-user-4';
			const endpoint = 'test-endpoint-4';
			const config = { maxRequests: 5, windowSeconds: 60 };

			const result = checkRateLimit(identifier, endpoint, config);
			expect(result.resetAt).toBeDefined();
			expect(result.resetAt).toBeGreaterThan(Date.now());
			expect(result.resetAt).toBeLessThanOrEqual(Date.now() + config.windowSeconds * 1000);
		});
	});

	describe('getClientIdentifier', () => {
		it('prefers user ID when provided', () => {
			const request = new Request('https://example.com/api/test', {
				headers: {
					'x-forwarded-for': '192.168.1.1',
					'x-real-ip': '10.0.0.1',
				},
			});

			const identifier = getClientIdentifier(request, 'user-123');
			expect(identifier).toBe('user:user-123');
		});

		it('falls back to x-forwarded-for header', () => {
			const request = new Request('https://example.com/api/test', {
				headers: {
					'x-forwarded-for': '192.168.1.1, 10.0.0.1',
				},
			});

			const identifier = getClientIdentifier(request);
			expect(identifier).toBe('ip:192.168.1.1');
		});

		it('falls back to x-real-ip header', () => {
			const request = new Request('https://example.com/api/test', {
				headers: {
					'x-real-ip': '10.0.0.1',
				},
			});

			const identifier = getClientIdentifier(request);
			expect(identifier).toBe('ip:10.0.0.1');
		});

		it('falls back to unknown when no headers present', () => {
			const request = new Request('https://example.com/api/test');

			const identifier = getClientIdentifier(request);
			expect(identifier).toBe('ip:unknown');
		});
	});

	describe('RATE_LIMITS', () => {
		it('has correct limits for auth endpoints', () => {
			expect(RATE_LIMITS.auth.maxRequests).toBe(5);
			expect(RATE_LIMITS.auth.windowSeconds).toBe(60);
		});

		it('has correct limits for AI endpoints', () => {
			expect(RATE_LIMITS.ai.maxRequests).toBe(20);
			expect(RATE_LIMITS.ai.windowSeconds).toBe(60);
		});

		it('has correct limits for API endpoints', () => {
			expect(RATE_LIMITS.api.maxRequests).toBe(100);
			expect(RATE_LIMITS.api.windowSeconds).toBe(60);
		});
	});
});
