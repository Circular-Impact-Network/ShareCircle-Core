'use client';

import { useState } from 'react';
import { Search, Loader2, Package, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useGetAllItemsQuery, Item } from '@/lib/redux/api/itemsApi';
import { ItemDetailsModal } from '@/components/modals/item-details-modal';
import { PageHeader, PageShell } from '@/components/ui/page';

interface AllListingsPageProps {
	onNavigate?: (page: string) => void;
}

export function AllListingsPage({ onNavigate }: AllListingsPageProps) {
	const [searchTerm, setSearchTerm] = useState('');
	const [selectedItem, setSelectedItem] = useState<Item | null>(null);

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

	return (
		<PageShell className="space-y-6">
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

			{/* Loading State */}
			{isLoading && (
				<div className="flex flex-col items-center justify-center py-12">
					<Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
					<p className="text-sm text-muted-foreground">Loading items...</p>
				</div>
			)}

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
				<div className="space-y-3">
					{filteredItems.map(item => (
						<Card
							key={item.id}
							className="group hover:border-primary/50 transition-all cursor-pointer"
							onClick={() => setSelectedItem(item)}
						>
							<CardContent className="flex items-center gap-4 p-4">
								{/* Item Image */}
								<div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
									<img
										src={item.imageUrl}
										alt={item.name}
										className="w-full h-full object-cover group-hover:scale-105 transition-transform"
									/>
								</div>

								{/* Item Info */}
								<div className="flex-1 min-w-0">
									<div className="flex items-start justify-between gap-2 mb-1">
										<h3 className="font-semibold text-foreground truncate">{item.name}</h3>
										{item.isOwner && (
											<Badge variant="secondary" className="text-xs flex-shrink-0">
												Your Item
											</Badge>
										)}
									</div>

									{item.description && (
										<p className="text-sm text-muted-foreground line-clamp-1 mb-2">
											{item.description}
										</p>
									)}

									<div className="flex items-center gap-3 text-sm text-muted-foreground">
										<div className="flex items-center gap-1.5">
											<Avatar className="h-4 w-4">
												<AvatarImage src={item.owner.image || undefined} />
												<AvatarFallback className="text-[8px]">
													{item.owner.name?.[0]?.toUpperCase() || '?'}
												</AvatarFallback>
											</Avatar>
											<span className="truncate">{item.owner.name || 'Unknown'}</span>
										</div>
										{item.circles.length > 0 && (
											<>
												<span>•</span>
												<span className="truncate">{item.circles[0].name}</span>
											</>
										)}
									</div>
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
