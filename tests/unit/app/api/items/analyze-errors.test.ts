import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({
	getServerSession: vi.fn(),
}));

vi.mock('@/lib/ai', () => ({
	analyzeImage: vi.fn(),
	validateItemInImage: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
	checkRateLimit: vi.fn(() => ({ success: true })),
	getClientIdentifier: vi.fn(() => 'test-client'),
	rateLimitResponse: vi.fn(),
	RATE_LIMITS: { ai: { limit: 10, windowMs: 60000 } },
}));

import { getServerSession } from 'next-auth';
import { analyzeImage } from '@/lib/ai';
import { POST } from '@/app/api/items/analyze/route';

const SUPABASE_IMAGE = 'https://project.supabase.co/storage/v1/object/sign/items/a.jpg';

const makeRequest = (body: Record<string, unknown>) =>
	new NextRequest('http://localhost/api/items/analyze', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
	});

const authed = () => vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user-1' } } as never);

describe('POST /api/items/analyze error normalization', () => {
	beforeEach(() => {
		vi.mocked(getServerSession).mockReset();
		vi.mocked(analyzeImage).mockReset();
	});

	it('returns 401 when not authenticated', async () => {
		vi.mocked(getServerSession).mockResolvedValue(null);
		const res = await POST(makeRequest({ imageUrl: SUPABASE_IMAGE }));
		expect(res.status).toBe(401);
	});

	it('returns 400 for a missing image URL', async () => {
		authed();
		const res = await POST(makeRequest({}));
		expect(res.status).toBe(400);
	});

	it('returns 400 for a non-Supabase image URL (SSRF guard)', async () => {
		authed();
		const res = await POST(makeRequest({ imageUrl: 'https://evil.example.com/a.jpg' }));
		expect(res.status).toBe(400);
	});

	it('returns 200 with the analysis on success', async () => {
		authed();
		vi.mocked(analyzeImage).mockResolvedValue({ name: 'Cordless drill' } as never);
		const res = await POST(makeRequest({ imageUrl: SUPABASE_IMAGE }));
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ name: 'Cordless drill' });
	});

	// The recent fix: collapse every flavour of Gemini quota/rate-limit error into a
	// single friendly 429 with code AI_RATE_LIMITED — never leak the raw provider dump.
	it.each([
		'You exceeded your current quota, please check your plan',
		'429 Too Many Requests',
		'RESOURCE_EXHAUSTED: rate limit',
	])('maps quota/rate-limit error %# to a friendly 429', async message => {
		authed();
		vi.mocked(analyzeImage).mockRejectedValue(new Error(message));

		const res = await POST(makeRequest({ imageUrl: SUPABASE_IMAGE }));
		expect(res.status).toBe(429);
		const data = (await res.json()) as { code?: string; error: string };
		expect(data.code).toBe('AI_RATE_LIMITED');
		// Must not echo the raw provider message back to the client.
		expect(data.error).not.toContain('RESOURCE_EXHAUSTED');
	});

	it('maps API-key errors to a generic configuration 500', async () => {
		authed();
		vi.mocked(analyzeImage).mockRejectedValue(new Error('Invalid API key provided'));
		const res = await POST(makeRequest({ imageUrl: SUPABASE_IMAGE }));
		expect(res.status).toBe(500);
		expect(await res.json()).toMatchObject({ error: 'AI service configuration error' });
	});

	it('falls back to a generic 500 for unexpected errors', async () => {
		authed();
		vi.mocked(analyzeImage).mockRejectedValue(new Error('socket hang up'));
		const res = await POST(makeRequest({ imageUrl: SUPABASE_IMAGE }));
		expect(res.status).toBe(500);
		expect(await res.json()).toMatchObject({ error: 'Failed to analyze image' });
	});
});
