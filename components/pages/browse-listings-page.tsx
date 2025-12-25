'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, Filter, X, Loader2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ItemDetailsModal } from '@/components/modals/item-details-modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useGetAllItemsQuery, useSearchItemsMutation, Item } from '@/lib/redux/api/itemsApi';
import { PageHeader, PageShell } from '@/components/ui/page';

export function BrowseListingsPage() {
	const [searchQuery, setSearchQuery] = useState('');
	const [selectedCategory, setSelectedCategory] = useState('All Categories');
	const [selectedItem, setSelectedItem] = useState<Item | null>(null);

	// Fetch all items across user's circles
	const { data: items = [], isLoading, error } = useGetAllItemsQuery();

	// Semantic search mutation
	const [searchItems, { data: searchResults, isLoading: isSearching, error: searchError }] =
		useSearchItemsMutation();

	// Debounced semantic search - only trigger when user stops typing
	useEffect(() => {
		if (searchQuery.length >= 3) {
			const timer = setTimeout(() => {
				searchItems({ query: searchQuery, limit: 50 });
			}, 400);
			return () => clearTimeout(timer);
		}
	}, [searchQuery, searchItems]);

	// Determine which items to display
	const displayItems = searchQuery.length >= 3 && searchResults ? searchResults : items;

	// Extract unique categories from display items
	const categories = useMemo(() => {
		const cats = new Set<string>();
		displayItems.forEach(item => {
			item.categories.forEach(cat => cats.add(cat));
		});
		return ['All Categories', ...Array.from(cats).sort()];
	}, [displayItems]);

	// Filter items based on category (search is handled by backend)
	const filteredItems = useMemo(() => {
		return displayItems.filter(item => {
			// Category filter
			const matchesCategory = selectedCategory === 'All Categories' || item.categories.includes(selectedCategory);
			return matchesCategory;
		});
	}, [displayItems, selectedCategory]);

	const handleResetFilters = () => {
		setSearchQuery('');
		setSelectedCategory('All Categories');
	};

	const hasActiveFilters = searchQuery !== '' || selectedCategory !== 'All Categories';

	// Combined loading state
	const isLoadingData = isLoading || (searchQuery.length >= 3 && isSearching);

	// Combined error state
	const hasError = error || searchError;

	return (
		<PageShell className="space-y-6">
			<PageHeader title="Browse Items" description="Discover items shared across all your circles" />

			{/* Search and Filter Bar */}
			<div className="flex flex-col gap-3 sm:flex-row">
				{/* Search Input */}
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search items, tags, or descriptions..."
						value={searchQuery}
						onChange={e => setSearchQuery(e.target.value)}
						className="pl-9 pr-9"
					/>
					{searchQuery && (
						<Button
							variant="ghost"
							size="sm"
							className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
							onClick={() => setSearchQuery('')}
						>
							<X className="h-4 w-4" />
						</Button>
					)}
				</div>

				{/* Category Filter */}
				<Select value={selectedCategory} onValueChange={setSelectedCategory}>
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
					searchQuery.length >= 3 && isSearching ? 'Searching...' : 'Loading items...'
				) : (
					<>
						{filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} found
						{searchQuery.length >= 3 && searchResults && ' (semantic search)'}
						{hasActiveFilters && !searchResults && ` (filtered from ${items.length} total)`}
					</>
				)}
			</div>

			{/* Loading State */}
			{isLoadingData && (
				<div className="flex flex-col items-center justify-center py-12">
					<Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
					<p className="text-sm text-muted-foreground">
						{searchQuery.length >= 3 && isSearching ? 'Searching with AI...' : 'Loading items...'}
					</p>
				</div>
			)}

			{/* Error State */}
			{hasError && (
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

			{/* Empty State - No Items */}
			{!isLoadingData && !hasError && items.length === 0 && (
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

			{/* Empty State - No Results */}
			{!isLoadingData && !hasError && displayItems.length > 0 && filteredItems.length === 0 && (
				<Card className="border-dashed border-border/70 bg-card">
					<CardContent className="flex flex-col items-center gap-4 text-center py-12">
						<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
							<Search className="h-7 w-7 text-muted-foreground" />
						</div>
						<div>
							<p className="font-medium text-foreground mb-1">No items found</p>
							<p className="text-sm text-muted-foreground mb-4">Try adjusting your search or filters</p>
							<Button variant="outline" onClick={handleResetFilters}>
								Clear Filters
							</Button>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Items Grid */}
			{!isLoadingData && !hasError && filteredItems.length > 0 && (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
					{filteredItems.map(item => (
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
									{item.circles.length > 0 && (
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
