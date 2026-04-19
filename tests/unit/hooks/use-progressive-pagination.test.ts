import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProgressivePagination } from '@/hooks/use-progressive-pagination';

describe('useProgressivePagination', () => {
	const items = Array.from({ length: 30 }, (_, i) => ({ id: String(i) }));

	it('returns first page of items', () => {
		const { result } = renderHook(() => useProgressivePagination({ items, pageSize: 10 }));
		expect(result.current.visibleItems).toHaveLength(10);
		expect(result.current.hasMore).toBe(true);
	});

	it('loadMore shows next page', () => {
		const { result } = renderHook(() => useProgressivePagination({ items, pageSize: 10 }));
		act(() => result.current.loadMore());
		expect(result.current.visibleItems).toHaveLength(20);
		expect(result.current.hasMore).toBe(true);
	});

	it('hasMore becomes false at end', () => {
		const { result } = renderHook(() => useProgressivePagination({ items, pageSize: 10 }));
		act(() => result.current.loadMore());
		act(() => result.current.loadMore());
		expect(result.current.visibleItems).toHaveLength(30);
		expect(result.current.hasMore).toBe(false);
	});

	it('handles empty array', () => {
		const { result } = renderHook(() => useProgressivePagination({ items: [], pageSize: 10 }));
		expect(result.current.visibleItems).toHaveLength(0);
		expect(result.current.hasMore).toBe(false);
	});

	it('handles items fewer than pageSize', () => {
		const shortItems = items.slice(0, 3);
		const { result } = renderHook(() => useProgressivePagination({ items: shortItems, pageSize: 10 }));
		expect(result.current.visibleItems).toHaveLength(3);
		expect(result.current.hasMore).toBe(false);
	});

	it('resets when items change', () => {
		let currentItems = items;
		const { result, rerender } = renderHook(() => useProgressivePagination({ items: currentItems, pageSize: 10 }));
		act(() => result.current.loadMore());
		expect(result.current.visibleItems).toHaveLength(20);

		currentItems = items.slice(0, 5);
		rerender();
		expect(result.current.visibleItems).toHaveLength(5);
	});
});
