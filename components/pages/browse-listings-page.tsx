'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Search, Filter, X, Loader2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ItemDetailsModal } from '@/components/modals/item-details-modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useGetAllItemsQuery, useSearchItemsMutation, Item, GetItemsFilters } from '@/lib/redux/api/itemsApi';
import { PageHeader, PageShell } from '@/components/ui/page';
import { useToast } from '@/hooks/use-toast';

export function BrowseListingsPage() {
	const { toast } = useToast();
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedCategory, setSelectedCategory] = useState('All Categories');
	const [selectedItem, setSelectedItem] = useState<Item | null>(null);
	const [isSearchActive, setIsSearchActive] = useState(false);
	const hasShownSearchErrorRef = useRef(false);

	// Build filters for the query
	const filters: GetItemsFilters = useMemo(() => ({
		category: selectedCategory !== 'All Categories' ? selectedCategory : undefined,
	}), [selectedCategory]);

	// Fetch all items across user's circles with category filter
	const { data: items = [], isLoading, error, refetch } = useGetAllItemsQuery(filters);

	// Semantic search mutation
	const [searchItems, { data: searchResults, isLoading: isSearching, error: searchError, reset: resetSearch }] =
		useSearchItemsMutation();

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

	// Execute semantic search
	const executeSearch = useCallback(() => {
		const trimmedQuery = searchQuery.trim();
		if (trimmedQuery.length >= 2) {
			setIsSearchActive(true);
			searchItems({ 
				query: trimmedQuery, 
				category: selectedCategory !== 'All Categories' ? selectedCategory : undefined,
				limit: 50 
			});
		}
	}, [searchQuery, selectedCategory, searchItems]);

	// Handle search on Enter key press
	const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			executeSearch();
		}
	}, [executeSearch]);

	// Clear search and reset to default items
	const clearSearch = useCallback(() => {
		setSearchQuery('');
		setIsSearchActive(false);
		resetSearch();
	}, [resetSearch]);

	// Handle category change - refetch from backend
	const handleCategoryChange = useCallback((category: string) => {
		setSelectedCategory(category);
		// Reset search when category changes
		if (isSearchActive) {
			setIsSearchActive(false);
			resetSearch();
		}
		// Category filtering is now handled by the query, which will auto-refetch
	}, [isSearchActive, resetSearch]);

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

	// Extract unique categories from ALL items (not filtered) for the dropdown
	const categories = useMemo(() => {
		const cats = new Set<string>();
		items.forEach(item => {
			item.categories.forEach(cat => cats.add(cat));
		});
		return ['All Categories', ...Array.from(cats).sort()];
	}, [items]);

	// Reset all filters
	const handleResetFilters = useCallback(() => {
		setSearchQuery('');
		setSelectedCategory('All Categories');
		setIsSearchActive(false);
		resetSearch();
	}, [resetSearch]);

	const hasActiveFilters = searchQuery !== '' || selectedCategory !== 'All Categories' || isSearchActive;

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
		<PageShell className="space-y-6">
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
					/>
					<div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
						{searchQuery && (
							<Button
								variant="ghost"
								size="sm"
								className="h-7 w-7 p-0"
								onClick={clearSearch}
							>
								<X className="h-4 w-4" />
							</Button>
						)}
						<Button
							variant="secondary"
							size="sm"
							className="h-7 px-2"
							onClick={executeSearch}
							disabled={searchQuery.trim().length < 2 || isSearching}
						>
							{isSearching ? (
								<Loader2 className="h-3 w-3 animate-spin" />
							) : (
								'Search'
							)}
						</Button>
					</div>
				</div>

				{/* Category Filter */}
				<Select value={selectedCategory} onValueChange={handleCategoryChange}>
					<SelectTrigger className="w-full sm:w-[200px]">
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
			{isLoading && (
				<div className="flex flex-col items-center justify-center py-12">
					<Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
					<p className="text-sm text-muted-foreground">Loading items...</p>
				</div>
			)}

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
					<CardContent className="flex flex-col items-center gap-4 text-center py-12">
						<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
							<Search className="h-7 w-7 text-muted-foreground" />
						</div>
						<div>
							<p className="font-medium text-foreground mb-1">No matching items found</p>
							<p className="text-sm text-muted-foreground mb-4">
								Try different search terms or clear the search
							</p>
							<Button variant="outline" onClick={clearSearch}>
								Clear Search
							</Button>
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
							<p className="text-sm text-muted-foreground mb-4">
								Try selecting a different category
							</p>
							<Button variant="outline" onClick={() => setSelectedCategory('All Categories')}>
								Show All Categories
							</Button>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Items Grid */}
			{!isLoading && displayItems.length > 0 && (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{displayItems.map(item => (
						<Card
							key={item.id}
							className="group overflow-hidden border-border/70 hover:border-primary/50 transition-all cursor-pointer"
							onClick={() => setSelectedItem(item)}
						>
							{/* Item Image */}
							<div className="aspect-square relative overflow-hidden bg-muted">
								<img
									src={item.imageUrl}
									alt={item.name}
									className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
								/>
								{item.isOwner && (
									<Badge className="absolute top-2 right-2 bg-primary/90 backdrop-blur-sm">
										Your Item
									</Badge>
								)}
							</div>

							{/* Item Details */}
							<CardContent className="p-4">
								<h3 className="font-semibold text-foreground truncate mb-1">{item.name}</h3>
								{item.description && (
									<p className="text-sm text-muted-foreground line-clamp-2 mb-3">
										{item.description}
									</p>
								)}

								{/* Tags */}
								{item.tags.length > 0 && (
									<div className="flex flex-wrap gap-1.5 mb-3">
										{item.tags.slice(0, 3).map(tag => (
											<Badge key={tag} variant="secondary" className="text-xs">
												{tag}
											</Badge>
										))}
										{item.tags.length > 3 && (
											<Badge variant="outline" className="text-xs">
												+{item.tags.length - 3}
											</Badge>
										)}
									</div>
								)}

								{/* Owner & Circle */}
								<div className="space-y-2">
									<div className="flex items-center gap-2 text-sm text-muted-foreground">
										<Avatar className="h-5 w-5">
											<AvatarImage src={item.owner.image || undefined} />
											<AvatarFallback className="text-[10px]">
												{item.owner.name?.[0]?.toUpperCase() || '?'}
											</AvatarFallback>
										</Avatar>
										<span className="truncate">{item.owner.name || 'Unknown'}</span>
									</div>
									{item.circles && item.circles.length > 0 && (
										<div className="text-xs text-muted-foreground truncate">
											in {item.circles.map(c => c.name).join(', ')}
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* Item Details Modal */}
			<ItemDetailsModal item={selectedItem} onOpenChange={open => !open && setSelectedItem(null)} />
		</PageShell>
	);
}
