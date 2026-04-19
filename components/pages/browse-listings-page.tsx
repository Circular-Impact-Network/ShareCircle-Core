'use client';

// Browse items and create item requests with circleIds, search, filters
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Filter, X, Loader2, Package, MessageCircle, Send, HandHelping, Check } from 'lucide-react';
import { ItemGridSkeleton } from '@/components/ui/skeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
	useGetItemsPaginatedQuery,
	useGetItemCategoriesQuery,
	useSearchItemsMutation,
	type GetItemsFilters,
} from '@/lib/redux/api/itemsApi';
import { useCreateItemRequestMutation } from '@/lib/redux/api/borrowApi';
import { useGetCirclesQuery } from '@/lib/redux/api/circlesApi';
import { PageHeader, PageShell, PageStickyHeader } from '@/components/ui/page';
import { useToast } from '@/hooks/use-toast';
import { ItemSummaryCard } from '@/components/cards/item-summary-card';
import { InfiniteScrollSentinel } from '@/components/ui/infinite-scroll-sentinel';

export function BrowseListingsPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { toast } = useToast();
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedCategory, setSelectedCategory] = useState('All Categories');
	const [isSearchActive, setIsSearchActive] = useState(false);
	const hasShownSearchErrorRef = useRef(false);
	const lastSearchKeyRef = useRef<string | null>(null);
	const [startingChatId, setStartingChatId] = useState<string | null>(null);

	// Item request form state
	const [showRequestForm, setShowRequestForm] = useState(false);
	const [requestTitle, setRequestTitle] = useState('');
	const [requestDescription, setRequestDescription] = useState('');
	const [requestCircleIds, setRequestCircleIds] = useState<string[]>([]);

	// Item request mutation
	const [createItemRequest, { isLoading: isCreatingRequest }] = useCreateItemRequestMutation();

	// Cursor state for infinite scroll pagination
	const [cursor, setCursor] = useState<string | undefined>(undefined);

	// Reset cursor when category filter changes
	useEffect(() => {
		setCursor(undefined);
	}, [selectedCategory]);

	// Build filters for the paginated query (memoized to avoid spurious hook re-runs)
	const filters = useMemo<GetItemsFilters & { limit: number; cursor?: string }>(
		() => ({
			category: selectedCategory !== 'All Categories' ? selectedCategory : undefined,
			limit: 24,
			cursor,
		}),
		[selectedCategory, cursor],
	);

	// Fetch paginated items (server-side cursor pagination)
	const { data: paginatedData, isLoading, error } = useGetItemsPaginatedQuery(filters);
	const items = useMemo(() => paginatedData?.items ?? [], [paginatedData?.items]);

	// Lightweight categories query (no item data / signed URLs)
	const { data: allCategories = [] } = useGetItemCategoriesQuery();

	// Semantic search mutation
	const [searchItems, { data: searchResults, isLoading: isSearching, error: searchError, reset: resetSearch }] =
		useSearchItemsMutation();
	const queryFromUrl = searchParams.get('q')?.trim() ?? '';
	const normalizedQueryFromUrl = queryFromUrl.length >= 2 ? queryFromUrl : '';

	// Show toast for errors instead of blocking the UI
	useEffect(() => {
		if (error && !hasShownSearchErrorRef.current) {
			hasShownSearchErrorRef.current = true;
			toast({
				title: 'Unable to load items',
				description: 'Please try again later.',
				variant: 'destructive',
			});
		}
	}, [error, toast]);

	// Show toast for search errors but continue showing default items
	useEffect(() => {
		if (searchError) {
			toast({
				title: 'Search temporarily unavailable',
				description: 'Showing default results instead.',
				variant: 'default',
			});
			// Reset search state to show default items
			setIsSearchActive(false);
		}
	}, [searchError, toast]);

	const executeSearch = useCallback(
		(queryOverride?: string) => {
			const trimmedQuery = (queryOverride ?? searchQuery).trim();
			if (trimmedQuery.length >= 2) {
				if (trimmedQuery !== queryFromUrl) {
					router.replace(`/browse?q=${encodeURIComponent(trimmedQuery)}`);
				}
				return;
			}
			if (queryFromUrl) {
				router.replace('/browse');
			}
		},
		[queryFromUrl, router, searchQuery],
	);

	useEffect(() => {
		setSearchQuery(currentQuery => (currentQuery === queryFromUrl ? currentQuery : queryFromUrl));
	}, [queryFromUrl]);

	useEffect(() => {
		if (!normalizedQueryFromUrl) {
			lastSearchKeyRef.current = null;
			setIsSearchActive(false);
			resetSearch();
			return;
		}

		setIsSearchActive(true);
		const searchKey = `${normalizedQueryFromUrl}::${selectedCategory}`;
		if (lastSearchKeyRef.current === searchKey) {
			return;
		}
		lastSearchKeyRef.current = searchKey;
		searchItems({
			query: normalizedQueryFromUrl,
			category: selectedCategory !== 'All Categories' ? selectedCategory : undefined,
			limit: 50,
		});
	}, [normalizedQueryFromUrl, resetSearch, searchItems, selectedCategory]);

	// Handle search on Enter key press
	const handleSearchKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				executeSearch();
			}
		},
		[executeSearch],
	);

	// Clear search and reset to default items
	const clearSearch = useCallback(() => {
		setSearchQuery('');
		if (queryFromUrl) {
			router.replace('/browse');
		}
	}, [queryFromUrl, router]);

	// Handle category change - refetch from backend
	const handleCategoryChange = useCallback((category: string) => {
		setSelectedCategory(category);
	}, []);

	// Determine which items to display
	const displayItems = useMemo(() => {
		// If search is active and we have results, show search results
		if (isSearchActive && searchResults && searchResults.length > 0) {
			return searchResults;
		}
		// If search is active but no results, show empty (handled by empty state)
		if (isSearchActive && searchResults && searchResults.length === 0) {
			return [];
		}
		// Default: show all items (already filtered by category from backend)
		return items;
	}, [isSearchActive, searchResults, items]);

	// Categories from lightweight API endpoint (no item data / signed URLs)
	const categories = useMemo(() => ['All Categories', ...allCategories], [allCategories]);

	// Get user's circles (only circles the user is a member of)
	const { data: userCircles = [] } = useGetCirclesQuery();
	const allRequestCirclesSelected = userCircles.length > 0 && requestCircleIds.length === userCircles.length;

	const toggleRequestCircle = (circleId: string) => {
		setRequestCircleIds(prev =>
			prev.includes(circleId) ? prev.filter(id => id !== circleId) : [...prev, circleId],
		);
	};

	const toggleAllRequestCircles = () => {
		if (allRequestCirclesSelected) {
			setRequestCircleIds([]);
			return;
		}
		setRequestCircleIds(userCircles.map(circle => circle.id));
	};

	// Handle item request submission
	const handleSubmitItemRequest = async () => {
		if (!requestTitle.trim()) {
			toast({ title: 'Please enter what you&apos;re looking for', variant: 'destructive' });
			return;
		}
		if (requestCircleIds.length === 0) {
			toast({ title: 'Please select at least one circle', variant: 'destructive' });
			return;
		}
		try {
			await createItemRequest({
				title: requestTitle.trim(),
				description: requestDescription.trim() || undefined,
				circleIds: requestCircleIds,
			}).unwrap();
			toast({ title: 'Request created!', description: 'Circle members will be notified.' });
			setShowRequestForm(false);
			setRequestTitle('');
			setRequestDescription('');
			setRequestCircleIds([]);
		} catch (error) {
			console.error('Create item request error:', error);
			const errorMessage =
				error && typeof error === 'object' && 'data' in error
					? (error.data as { error?: string })?.error || 'Failed to create request'
					: 'Failed to create request. Please try again.';
			toast({
				title: 'Failed to create request',
				description: errorMessage,
				variant: 'destructive',
			});
		}
	};

	// Pre-fill request form with search query
	useEffect(() => {
		if (isSearchActive && displayItems.length === 0 && searchQuery) {
			setRequestTitle(searchQuery);
		}
	}, [isSearchActive, displayItems.length, searchQuery]);

	// Reset all filters
	const handleResetFilters = useCallback(() => {
		setSearchQuery('');
		setSelectedCategory('All Categories');
		if (queryFromUrl) {
			router.replace('/browse');
		}
	}, [queryFromUrl, router]);

	async function handleStartChat(ownerId: string) {
		if (!ownerId) return;
		setStartingChatId(ownerId);
		try {
			const response = await fetch('/api/messages/threads', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ otherUserId: ownerId }),
			});
			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to start chat');
			}
			const data = await response.json();
			router.push(`/messages/${data.id}`);
		} catch (error) {
			console.error('Start chat error:', error);
			toast({
				title: 'Unable to start chat',
				description: error instanceof Error ? error.message : 'Please try again.',
				variant: 'destructive',
			});
		} finally {
			setStartingChatId(null);
		}
	}

	const hasActiveFilters = searchQuery !== '' || selectedCategory !== 'All Categories' || isSearchActive;

	// For search results, show all (already limited by search API). For browse, use server pagination.
	const visibleDisplayItems = displayItems;
	const hasMoreDisplayItems = isSearchActive ? false : (paginatedData?.hasMore ?? false);
	const loadMoreDisplayItems = useCallback(() => {
		if (paginatedData?.nextCursor) {
			setCursor(paginatedData.nextCursor);
		}
	}, [paginatedData?.nextCursor]);

	// Combined loading state
	const isLoadingData = isLoading || isSearching;

	// Get display text for results count
	const getResultsText = () => {
		const count = displayItems.length;
		const itemText = count === 1 ? 'item' : 'items';

		if (isSearchActive && searchResults) {
			return `${count} ${itemText} found`;
		}
		if (selectedCategory !== 'All Categories') {
			return `${count} ${itemText} in "${selectedCategory}"`;
		}
		return `${count} ${itemText}`;
	};

	return (
		<PageShell>
			<PageStickyHeader className="pt-5 sm:pt-6 lg:pt-7 pb-4 space-y-4">
				<PageHeader title="Browse Items" description="Discover items shared across all your circles" />

				{/* Search and Filter Bar */}
				<div className="flex flex-col gap-3 sm:flex-row">
					{/* Search Input */}
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search items... (press Enter to search)"
							value={searchQuery}
							onChange={e => setSearchQuery(e.target.value)}
							onKeyDown={handleSearchKeyDown}
							className="pl-9 pr-20"
							data-testid="search-input"
						/>
						<div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
							{searchQuery && (
								<Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={clearSearch}>
									<X className="h-4 w-4" />
								</Button>
							)}
							<Button
								variant="secondary"
								size="sm"
								className="h-7 px-2"
								onClick={() => executeSearch()}
								disabled={searchQuery.trim().length < 2 || isSearching}
							>
								{isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Search'}
							</Button>
						</div>
					</div>

					{/* Category Filter */}
					<Select value={selectedCategory} onValueChange={handleCategoryChange}>
						<SelectTrigger className="w-full sm:w-[200px]" data-testid="category-filter">
							<Filter className="h-4 w-4 mr-2" />
							<SelectValue placeholder="Category" />
						</SelectTrigger>
						<SelectContent>
							{categories.map(category => (
								<SelectItem key={category} value={category}>
									{category}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{/* Reset Filters */}
					{hasActiveFilters && (
						<Button variant="outline" onClick={handleResetFilters} className="gap-2 sm:self-start">
							<X className="h-4 w-4" />
							Clear
						</Button>
					)}
				</div>
			</PageStickyHeader>

			{/* Results Count */}
			<div className="flex items-center justify-between text-sm text-muted-foreground">
				{isLoadingData ? (
					<div className="flex items-center gap-2">
						<Loader2 className="h-4 w-4 animate-spin" />
						{isSearching ? 'Searching...' : 'Loading items...'}
					</div>
				) : (
					<span>{getResultsText()}</span>
				)}
			</div>

			{/* Loading State */}
			{isLoading && <ItemGridSkeleton count={8} />}

			{/* Empty State - No Items at all */}
			{!isLoadingData && items.length === 0 && !isSearchActive && (
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

			{/* Empty State - No Search Results */}
			{!isLoadingData && isSearchActive && displayItems.length === 0 && (
				<Card className="border-dashed border-border/70 bg-card">
					<CardContent className="flex flex-col items-center gap-4 text-center py-8">
						<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
							<Search className="h-7 w-7 text-muted-foreground" />
						</div>
						<div>
							<p className="font-medium text-foreground mb-1">No matching items found</p>
							<p className="text-sm text-muted-foreground mb-4">
								Can&apos;t find what you need? Request it from your circles!
							</p>
							{!showRequestForm ? (
								<div className="flex flex-wrap justify-center gap-2">
									<Button variant="outline" onClick={clearSearch}>
										Clear Search
									</Button>
									<Button onClick={() => setShowRequestForm(true)} className="gap-2">
										<HandHelping className="h-4 w-4" />
										Request Item
									</Button>
								</div>
							) : (
								<div className="w-full max-w-md text-left space-y-3 mt-4">
									<Input
										placeholder="What are you looking for?"
										value={requestTitle}
										onChange={e => setRequestTitle(e.target.value)}
									/>
									<Textarea
										placeholder="Add any details (optional)"
										value={requestDescription}
										onChange={e => setRequestDescription(e.target.value)}
										rows={2}
									/>
									<div className="space-y-2">
										{userCircles.length > 1 && (
											<Button variant="outline" type="button" onClick={toggleAllRequestCircles}>
												{allRequestCirclesSelected
													? 'Deselect All Circles'
													: 'Select All Circles'}
											</Button>
										)}
										<div className="app-scrollbar app-scrollbar-thin max-h-44 space-y-2 overflow-auto rounded-md border p-2">
											{userCircles.map(circle => {
												const isSelected = requestCircleIds.includes(circle.id);
												return (
													<button
														key={circle.id}
														type="button"
														onClick={() => toggleRequestCircle(circle.id)}
														className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm ${
															isSelected ? 'bg-primary/10' : 'hover:bg-muted'
														}`}
													>
														<div
															className={`h-4 w-4 rounded border flex items-center justify-center ${
																isSelected
																	? 'border-primary bg-primary text-primary-foreground'
																	: 'border-muted-foreground'
															}`}
														>
															{isSelected && <Check className="h-3 w-3" />}
														</div>
														<span>{circle.name}</span>
													</button>
												);
											})}
										</div>
									</div>
									<div className="flex flex-wrap gap-2">
										<Button
											variant="outline"
											onClick={() => {
												setShowRequestForm(false);
												setRequestTitle('');
												setRequestDescription('');
												setRequestCircleIds([]);
											}}
										>
											Cancel
										</Button>
										<Button
											onClick={handleSubmitItemRequest}
											disabled={
												isCreatingRequest ||
												!requestTitle.trim() ||
												requestCircleIds.length === 0
											}
											className="gap-2"
										>
											{isCreatingRequest ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : (
												<Send className="h-4 w-4" />
											)}
											Send Request
										</Button>
									</div>
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Empty State - No Items in Category */}
			{!isLoadingData && !isSearchActive && items.length === 0 && selectedCategory !== 'All Categories' && (
				<Card className="border-dashed border-border/70 bg-card">
					<CardContent className="flex flex-col items-center gap-4 text-center py-12">
						<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
							<Filter className="h-7 w-7 text-muted-foreground" />
						</div>
						<div>
							<p className="font-medium text-foreground mb-1">No items in this category</p>
							<p className="text-sm text-muted-foreground mb-4">Try selecting a different category</p>
							<Button variant="outline" onClick={() => setSelectedCategory('All Categories')}>
								Show All Categories
							</Button>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Items Grid */}
			{!isLoading && displayItems.length > 0 && (
				<>
					<div
						className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
						data-testid="items-grid"
					>
						{visibleDisplayItems.map(item => (
							<ItemSummaryCard
								key={item.id}
								item={item}
								onClick={() => router.push(`/items/${item.id}`)}
								showMediaActions
								actions={
									<div
										className="flex flex-wrap gap-2"
										onClick={event => {
											event.stopPropagation();
										}}
									>
										{!item.isOwner ? (
											<>
												<Button
													variant="outline"
													size="sm"
													className="gap-2"
													onClick={() => handleStartChat(item.owner.id)}
													disabled={startingChatId === item.owner.id}
												>
													{startingChatId === item.owner.id ? (
														<Loader2 className="h-4 w-4 animate-spin" />
													) : (
														<MessageCircle className="h-4 w-4" />
													)}
													Chat
												</Button>
												<Button size="sm" onClick={() => router.push(`/items/${item.id}`)}>
													Borrow
												</Button>
											</>
										) : (
											<Button
												variant="outline"
												size="sm"
												onClick={() => router.push(`/items/${item.id}`)}
											>
												View item
											</Button>
										)}
									</div>
								}
							/>
						))}
					</div>
					<InfiniteScrollSentinel
						hasMore={hasMoreDisplayItems}
						isLoading={false}
						onLoadMore={loadMoreDisplayItems}
						label="Loading more items"
					/>
				</>
			)}
		</PageShell>
	);
}
