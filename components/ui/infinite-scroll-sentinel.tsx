'use client';

import { Loader2 } from 'lucide-react';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { cn } from '@/lib/utils';

type InfiniteScrollSentinelProps = {
	hasMore: boolean;
	isLoading?: boolean;
	onLoadMore: () => void;
	enabled?: boolean;
	className?: string;
	label?: string;
};

export function InfiniteScrollSentinel({
	hasMore,
	isLoading = false,
	onLoadMore,
	enabled = true,
	className,
	label = 'Loading more',
}: InfiniteScrollSentinelProps) {
	const sentinelRef = useInfiniteScroll({
		hasMore,
		isLoading,
		onLoadMore,
		enabled,
	});

	if (!hasMore && !isLoading) {
		return null;
	}

	return (
		<div
			ref={sentinelRef}
			aria-hidden="true"
			className={cn('flex min-h-16 items-center justify-center py-3', className)}
		>
			{isLoading ? (
				<span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs text-muted-foreground shadow-sm">
					<Loader2 className="h-3.5 w-3.5 animate-spin" />
					{label}
				</span>
			) : (
				<span className="sr-only">Load more content</span>
			)}
		</div>
	);
}
