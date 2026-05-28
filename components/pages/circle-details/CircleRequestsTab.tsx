'use client';

import { PackageOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { InfiniteScrollSentinel } from '@/components/ui/infinite-scroll-sentinel';
import { RequestCardListSkeleton } from '@/components/ui/skeletons';
import { ItemRequestCard } from '@/components/cards/item-request-card';
import { ItemRequestFilter, type ItemRequestFilterValue } from '@/components/app/item-request-filter';
import type { ItemRequest } from '@/lib/redux/api/borrowApi';

type CircleRequestsTabProps = {
	filter: ItemRequestFilterValue;
	onFilterChange: (value: ItemRequestFilterValue) => void;
	isLoading: boolean;
	filteredRequests: ItemRequest[];
	visibleRequests: ItemRequest[];
	hasMore: boolean;
	loadMore: () => void;
	myItemRequests: ItemRequest[];
	respondingRequestId: string | null;
	onRespond: (requestId: string, requesterId: string, requestTitle: string) => void;
	onIgnore: (requestId: string) => void;
	onClose: (requestId: string) => void;
};

const EMPTY_COPY: Record<ItemRequestFilterValue, { title: string; body: string }> = {
	'from-others': {
		title: 'No open requests from others',
		body: 'When circle members need something, their requests will appear here',
	},
	mine: {
		title: 'You have no requests',
		body: 'Post a request if you need to borrow something from this circle',
	},
	all: {
		title: 'No item requests',
		body: 'Item requests for this circle will appear here',
	},
};

export function CircleRequestsTab({
	filter,
	onFilterChange,
	isLoading,
	filteredRequests,
	visibleRequests,
	hasMore,
	loadMore,
	myItemRequests,
	respondingRequestId,
	onRespond,
	onIgnore,
	onClose,
}: CircleRequestsTabProps) {
	const empty = EMPTY_COPY[filter];

	return (
		<>
			<ItemRequestFilter value={filter} onChange={onFilterChange} />
			{isLoading ? (
				<RequestCardListSkeleton count={3} />
			) : filteredRequests.length === 0 ? (
				<Card className="border-dashed border-border/70 bg-card">
					<CardContent className="flex flex-col items-center gap-4 text-center py-12">
						<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
							<PackageOpen className="h-7 w-7 text-muted-foreground" />
						</div>
						<div>
							<p className="font-medium text-foreground mb-1">{empty.title}</p>
							<p className="text-sm text-muted-foreground">{empty.body}</p>
						</div>
					</CardContent>
				</Card>
			) : (
				<>
					<div className="space-y-3">
						{visibleRequests.map(request => (
							<ItemRequestCard
								key={request.id}
								request={request}
								onRespond={onRespond}
								onIgnore={onIgnore}
								onClose={onClose}
								isMyRequest={myItemRequests.some(r => r.id === request.id)}
								isResponding={respondingRequestId === request.id}
							/>
						))}
					</div>
					<InfiniteScrollSentinel hasMore={hasMore} onLoadMore={loadMore} label="Loading more requests" />
				</>
			)}
		</>
	);
}
