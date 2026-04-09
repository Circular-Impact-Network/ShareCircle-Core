'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Package, X } from 'lucide-react';
import { ItemGridSkeleton } from '@/components/ui/skeletons';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useGetAllItemsQuery } from '@/lib/redux/api/itemsApi';
import { PageHeader, PageShell, PageStickyHeader } from '@/components/ui/page';
import { ItemSummaryCard } from '@/components/cards/item-summary-card';
import { InfiniteScrollSentinel } from '@/components/ui/infinite-scroll-sentinel';
import { useProgressivePagination } from '@/hooks/use-progressive-pagination';

export function AllListingsPage() {
	const router = useRouter();
	const [searchTerm, setSearchTerm] = useState('');

	// Fetch all items across user's circles
	const { data: items = [], isLoading, error } = useGetAllItemsQuery();

	// Filter items based on search
	const filteredItems = items.filter(
		item =>
			searchTerm === '' ||
			item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
			item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			item.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
			item.circles.some(circle => circle.name.toLowerCase().includes(searchTerm.toLowerCase())),
	);
	const {
		visibleItems,
		hasMore,
		loadMore,
	} = useProgressivePagination({ items: filteredItems, pageSize: 12 });

	return (
		<PageShell>
			<PageStickyHeader className="pt-5 sm:pt-6 lg:pt-7 pb-4 space-y-4">
				<PageHeader title="All Listings" description="Browse all items shared across your circles" />

				{/* Search Bar */}
				<div className="space-y-2">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search items, circles, or tags..."
							value={searchTerm}
							onChange={e => setSearchTerm(e.target.value)}
							className="pl-9"
						/>
					</div>
					{filteredItems.length > 0 && (
						<p className="text-sm text-muted-foreground">
							Showing {filteredItems.length} of {items.length} items
						</p>
					)}
				</div>
			</PageStickyHeader>

			{/* Loading State */}
			{isLoading && <ItemGridSkeleton count={8} />}

			{/* Error State */}
			{error && (
				<Card className="border-destructive/50 bg-destructive/10">
					<CardContent className="flex flex-col items-center gap-4 text-center py-12">
						<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/20">
							<X className="h-7 w-7 text-destructive" />
						</div>
						<div>
							<p className="font-medium text-foreground mb-1">Failed to load items</p>
							<p className="text-sm text-muted-foreground">Please try refreshing the page.</p>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Empty State */}
			{!isLoading && !error && items.length === 0 && (
				<Card className="border-dashed border-border/70 bg-card">
					<CardContent className="flex flex-col items-center gap-4 text-center py-12">
						<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
							<Package className="h-7 w-7 text-primary" />
						</div>
						<div>
							<p className="font-medium text-foreground mb-1">No items yet</p>
							<p className="text-sm text-muted-foreground">
								Items shared in your circles will appear here.
							</p>
						</div>
					</CardContent>
				</Card>
			)}

			{/* No Results */}
			{!isLoading && !error && items.length > 0 && filteredItems.length === 0 && (
				<Card className="border-dashed border-border/70 bg-card">
					<CardContent className="flex flex-col items-center gap-4 text-center py-12">
						<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
							<Search className="h-7 w-7 text-muted-foreground" />
						</div>
						<div>
							<p className="font-medium text-foreground mb-1">No items found</p>
							<p className="text-sm text-muted-foreground">Try a different search term</p>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Items List */}
			{!isLoading && !error && filteredItems.length > 0 && (
				<>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{visibleItems.map(item => (
							<ItemSummaryCard
								key={item.id}
								item={item}
								onClick={() => router.push(`/items/${item.id}`)}
								actions={
									<div
										className="flex flex-wrap gap-2"
										onClick={event => {
											event.stopPropagation();
										}}
									>
										<span className="text-xs text-muted-foreground">Browse across your circles</span>
									</div>
								}
							/>
						))}
					</div>
					<InfiniteScrollSentinel hasMore={hasMore} onLoadMore={loadMore} label="Loading more items" />
				</>
			)}
		</PageShell>
	);
}
