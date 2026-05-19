'use client';

import { useCallback, useMemo, useState } from 'react';

type UseProgressivePaginationOptions<T> = {
	items: T[];
	pageSize?: number;
};

export function useProgressivePagination<T>({ items, pageSize = 12 }: UseProgressivePaginationOptions<T>) {
	const [visibleCount, setVisibleCount] = useState(pageSize);
	const resolvedVisibleCount = Math.min(Math.max(visibleCount, pageSize), items.length || pageSize);
	const visibleItems = useMemo(() => items.slice(0, resolvedVisibleCount), [items, resolvedVisibleCount]);
	const hasMore = resolvedVisibleCount < items.length;

	const loadMore = useCallback(() => {
		setVisibleCount(current => Math.min(current + pageSize, items.length));
	}, [items.length, pageSize]);

	const reset = useCallback(() => {
		setVisibleCount(pageSize);
	}, [pageSize]);

	return {
		visibleItems,
		visibleCount: resolvedVisibleCount,
		totalCount: items.length,
		hasMore,
		loadMore,
		reset,
	};
}
