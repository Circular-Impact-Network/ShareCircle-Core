'use client';

import { useEffect, useRef } from 'react';

type UseInfiniteScrollOptions = {
	hasMore: boolean;
	isLoading?: boolean;
	onLoadMore: () => void;
	enabled?: boolean;
	rootSelector?: string;
	rootMargin?: string;
	threshold?: number;
};

const DEFAULT_ROOT_SELECTOR = '[data-scroll-root="authenticated-main"]';

export function useInfiniteScroll({
	hasMore,
	isLoading = false,
	onLoadMore,
	enabled = true,
	rootSelector = DEFAULT_ROOT_SELECTOR,
	rootMargin = '0px 0px 240px 0px',
	threshold = 0,
}: UseInfiniteScrollOptions) {
	const targetRef = useRef<HTMLDivElement | null>(null);
	const onLoadMoreRef = useRef(onLoadMore);
	const triggerLockedRef = useRef(false);

	useEffect(() => {
		onLoadMoreRef.current = onLoadMore;
	}, [onLoadMore]);

	useEffect(() => {
		if (!isLoading) {
			triggerLockedRef.current = false;
		}
	}, [isLoading, hasMore]);

	useEffect(() => {
		const target = targetRef.current;
		if (!enabled || !hasMore || !target) return;

		const root = document.querySelector(rootSelector);
		const rootElement = root instanceof Element ? root : null;
		const observer = new IntersectionObserver(
			entries => {
				const entry = entries[0];
				if (!entry?.isIntersecting || isLoading || triggerLockedRef.current) {
					return;
				}

				triggerLockedRef.current = true;
				onLoadMoreRef.current();
			},
			{
				root: rootElement,
				rootMargin,
				threshold,
			},
		);

		observer.observe(target);
		return () => observer.disconnect();
	}, [enabled, hasMore, isLoading, rootMargin, rootSelector, threshold]);

	return targetRef;
}
