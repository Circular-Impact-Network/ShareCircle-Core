/**
 * Unit tests for useMediaQuery hook
 * Tests: SSR handling, media query matching, change event handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

describe('useMediaQuery Hook', () => {
	let originalMatchMedia: typeof window.matchMedia;
	let mockMatchMedia: ReturnType<typeof vi.fn>;
	let mockMediaQueryList: {
		matches: boolean;
		media: string;
		addEventListener: ReturnType<typeof vi.fn>;
		removeEventListener: ReturnType<typeof vi.fn>;
		addListener: ReturnType<typeof vi.fn>;
		removeListener: ReturnType<typeof vi.fn>;
	};
	let changeCallback: (() => void) | null = null;

	beforeEach(() => {
		originalMatchMedia = window.matchMedia;

		mockMediaQueryList = {
			matches: false,
			media: '',
			addEventListener: vi.fn((event, callback) => {
				if (event === 'change') {
					changeCallback = callback;
				}
			}),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
		};

		mockMatchMedia = vi.fn((query: string) => ({
			...mockMediaQueryList,
			media: query,
		}));

		Object.defineProperty(window, 'matchMedia', {
			writable: true,
			value: mockMatchMedia,
		});
	});

	afterEach(() => {
		Object.defineProperty(window, 'matchMedia', {
			writable: true,
			value: originalMatchMedia,
		});
		changeCallback = null;
	});

	it('returns false initially for non-matching query', () => {
		mockMediaQueryList.matches = false;

		const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));

		expect(result.current).toBe(false);
	});

	it('returns true for matching query', () => {
		mockMatchMedia.mockImplementation((query: string) => ({
			...mockMediaQueryList,
			matches: true,
			media: query,
		}));

		const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));

		expect(result.current).toBe(true);
	});

	it('calls matchMedia with the provided query', () => {
		renderHook(() => useMediaQuery('(min-width: 1024px)'));

		expect(mockMatchMedia).toHaveBeenCalledWith('(min-width: 1024px)');
	});

	it('subscribes to media query changes', () => {
		renderHook(() => useMediaQuery('(min-width: 768px)'));

		expect(mockMediaQueryList.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
	});

	it('unsubscribes on unmount', () => {
		const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));

		unmount();

		expect(mockMediaQueryList.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
	});

	it('updates when media query changes', async () => {
		// Start with non-matching
		mockMatchMedia.mockImplementation((query: string) => ({
			...mockMediaQueryList,
			matches: false,
			media: query,
			addEventListener: (event: string, callback: () => void) => {
				if (event === 'change') {
					changeCallback = callback;
				}
			},
			removeEventListener: vi.fn(),
		}));

		const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));

		expect(result.current).toBe(false);

		// Simulate media query change
		mockMatchMedia.mockImplementation((query: string) => ({
			...mockMediaQueryList,
			matches: true,
			media: query,
		}));

		if (changeCallback) {
			act(() => {
				changeCallback!();
			});
		}

		// Result should update
		expect(result.current).toBe(true);
	});

	it('handles different query strings', () => {
		const queries = [
			'(min-width: 640px)',
			'(min-width: 768px)',
			'(min-width: 1024px)',
			'(min-width: 1280px)',
			'(prefers-color-scheme: dark)',
		];

		queries.forEach(query => {
			mockMatchMedia.mockClear();
			renderHook(() => useMediaQuery(query));
			expect(mockMatchMedia).toHaveBeenCalledWith(query);
		});
	});

	it('falls back to addListener for older browsers', () => {
		// Simulate older browser without addEventListener
		mockMatchMedia.mockImplementation((query: string) => ({
			matches: false,
			media: query,
			addEventListener: undefined,
			removeEventListener: undefined,
			addListener: mockMediaQueryList.addListener,
			removeListener: mockMediaQueryList.removeListener,
		}));

		const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));

		expect(mockMediaQueryList.addListener).toHaveBeenCalled();

		unmount();

		expect(mockMediaQueryList.removeListener).toHaveBeenCalled();
	});

	it('handles query string changes by resubscribing', () => {
		const { rerender } = renderHook(
			({ query }) => useMediaQuery(query),
			{ initialProps: { query: '(min-width: 768px)' } }
		);

		expect(mockMatchMedia).toHaveBeenCalledWith('(min-width: 768px)');

		mockMatchMedia.mockClear();

		rerender({ query: '(min-width: 1024px)' });

		expect(mockMatchMedia).toHaveBeenCalledWith('(min-width: 1024px)');
	});
});
