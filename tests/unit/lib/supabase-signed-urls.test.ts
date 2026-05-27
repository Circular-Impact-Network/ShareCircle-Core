import { describe, it, expect, vi, beforeEach } from 'vitest';

// Capture how many times createSignedUrls is invoked so we can assert batching
// behaviour (one call per bucket, regardless of path count).
const mockCreateSignedUrls = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
	createClient: () => ({
		storage: {
			from: (_bucket: string) => ({
				createSignedUrl: vi.fn(),
				createSignedUrls: mockCreateSignedUrls,
				upload: vi.fn(),
				remove: vi.fn(),
			}),
		},
	}),
}));

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');

import { getSignedUrls } from '@/lib/supabase';

describe('getSignedUrls (batch)', () => {
	beforeEach(() => {
		mockCreateSignedUrls.mockReset();
	});

	it('returns an empty map for an empty path array without calling Supabase', async () => {
		const result = await getSignedUrls([], 'items');
		expect(result.size).toBe(0);
		expect(mockCreateSignedUrls).not.toHaveBeenCalled();
	});

	it('deduplicates paths and calls Supabase exactly once for N paths', async () => {
		mockCreateSignedUrls.mockResolvedValue({
			data: [
				{ path: 'a.jpg', signedUrl: 'https://signed/a' },
				{ path: 'b.jpg', signedUrl: 'https://signed/b' },
				{ path: 'c.jpg', signedUrl: 'https://signed/c' },
			],
			error: null,
		});

		const result = await getSignedUrls(['a.jpg', 'b.jpg', 'a.jpg', 'c.jpg', 'b.jpg'], 'items');
		expect(mockCreateSignedUrls).toHaveBeenCalledTimes(1);
		// 3 unique paths were sent
		expect(mockCreateSignedUrls.mock.calls[0][0]).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
		expect(result.get('a.jpg')).toBe('https://signed/a');
		expect(result.get('b.jpg')).toBe('https://signed/b');
		expect(result.get('c.jpg')).toBe('https://signed/c');
	});

	it('skips paths already present in the in-process cache (warm second call)', async () => {
		mockCreateSignedUrls.mockResolvedValue({
			data: [{ path: 'warm.jpg', signedUrl: 'https://signed/warm' }],
			error: null,
		});

		await getSignedUrls(['warm.jpg'], 'cache-test-bucket-1');
		// Second call should hit the in-process cache and not call Supabase again.
		mockCreateSignedUrls.mockClear();
		const second = await getSignedUrls(['warm.jpg'], 'cache-test-bucket-1');
		expect(mockCreateSignedUrls).not.toHaveBeenCalled();
		expect(second.get('warm.jpg')).toBe('https://signed/warm');
	});

	it('throws when Supabase returns an error', async () => {
		mockCreateSignedUrls.mockResolvedValue({ data: null, error: { message: 'boom' } });
		await expect(getSignedUrls(['z.jpg'], 'unique-bucket-err')).rejects.toThrow(/boom/);
	});
});
