'use client';

import { useState } from 'react';
import { Plus, Loader2, Package, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AddItemModal } from '@/components/modals/add-item-modal';
import { ItemDetailsModal } from '@/components/modals/item-details-modal';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { useGetAllItemsQuery, useDeleteItemMutation, Item } from '@/lib/redux/api/itemsApi';
import { useToast } from '@/hooks/use-toast';

export function MyListingsPage() {
	const [showAddItem, setShowAddItem] = useState(false);
	const [selectedItem, setSelectedItem] = useState<Item | null>(null);
	const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
	const { toast } = useToast();

	// Fetch all items
	const { data: allItems = [], isLoading, refetch } = useGetAllItemsQuery();
	const [deleteItem, { isLoading: isDeletingItem }] = useDeleteItemMutation();

	// Filter to only user's items
	const myItems = allItems.filter(item => item.isOwner);

	const handleDelete = async () => {
		if (!itemToDelete) return;

		try {
			await deleteItem(itemToDelete.id).unwrap();
			toast({
				title: 'Item deleted',
				description: `${itemToDelete.name} has been deleted.`,
			});
			setItemToDelete(null);
		} catch (error) {
			console.error('Failed to delete item:', error);
			toast({
				title: 'Error',
				description: 'Failed to delete item. Please try again.',
				variant: 'destructive',
			});
		}
	};

	return (
		<div className="p-4 sm:p-6 lg:p-8">
			{/* Header */}
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">My Listings</h1>
					<p className="text-muted-foreground">Manage items you&apos;re sharing</p>
				</div>
				<Button onClick={() => setShowAddItem(true)} className="gap-2">
					<Plus className="h-4 w-4" />
					<span className="hidden sm:inline">Add Item</span>
					<span className="sm:hidden">Add</span>
				</Button>
			</div>

			{/* Tabs for different item states */}
			<Tabs defaultValue="all" className="space-y-6">
				<TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-grid">
					<TabsTrigger value="all">
						All Items
						{myItems.length > 0 && (
							<Badge variant="secondary" className="ml-2">
								{myItems.length}
							</Badge>
						)}
					</TabsTrigger>
					<TabsTrigger value="active">Active</TabsTrigger>
				</TabsList>

				{/* All Items Tab */}
				<TabsContent value="all" className="space-y-4">
					{/* Loading State */}
					{isLoading && (
						<div className="flex flex-col items-center justify-center py-12">
							<Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
							<p className="text-sm text-muted-foreground">Loading your items...</p>
						</div>
					)}

					{/* Empty State */}
					{!isLoading && myItems.length === 0 && (
						<Card className="border-dashed border-border/70 bg-card">
							<CardContent className="flex flex-col items-center gap-4 text-center py-12">
								<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
									<Package className="h-7 w-7 text-primary" />
								</div>
								<div>
									<p className="font-medium text-foreground mb-1">No items yet</p>
									<p className="text-sm text-muted-foreground mb-4">
										Start sharing items with your circles
									</p>
									<Button onClick={() => setShowAddItem(true)} className="gap-2">
										<Plus className="h-4 w-4" />
										Add Your First Item
									</Button>
								</div>
							</CardContent>
						</Card>
					)}

					{/* Items Grid */}
					{!isLoading && myItems.length > 0 && (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
							{myItems.map(item => (
								<Card
									key={item.id}
									className="group overflow-hidden border-border/70 hover:border-primary/50 transition-all"
								>
									{/* Item Image */}
									<div
										className="aspect-square relative overflow-hidden bg-muted cursor-pointer"
										onClick={() => setSelectedItem(item)}
									>
										<img
											src={item.imageUrl}
											alt={item.name}
											className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
										/>
										<div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
											<Button
												variant="secondary"
												size="icon"
												className="h-8 w-8 bg-background/80 backdrop-blur-sm"
												onClick={e => {
													e.stopPropagation();
													setItemToDelete(item);
												}}
											>
												<Trash2 className="h-4 w-4 text-destructive" />
											</Button>
										</div>
									</div>

									{/* Item Details */}
									<CardContent className="p-4">
										<h3
											className="font-semibold text-foreground truncate mb-1 cursor-pointer hover:text-primary"
											onClick={() => setSelectedItem(item)}
										>
											{item.name}
										</h3>
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

										{/* Shared in Circles */}
										{item.circles.length > 0 && (
											<div className="text-xs text-muted-foreground truncate">
												Shared in: {item.circles.map(c => c.name).join(', ')}
											</div>
										)}
									</CardContent>
								</Card>
							))}
						</div>
					)}
				</TabsContent>

				{/* Active Tab (same content for now) */}
				<TabsContent value="active" className="space-y-4">
					{!isLoading && myItems.length === 0 ? (
						<Card className="border-dashed border-border/70 bg-card">
							<CardContent className="flex flex-col items-center gap-4 text-center py-12">
								<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
									<Package className="h-7 w-7 text-primary" />
								</div>
								<div>
									<p className="font-medium text-foreground mb-1">No active items</p>
									<p className="text-sm text-muted-foreground">
										Your active listings will appear here
									</p>
								</div>
							</CardContent>
						</Card>
					) : (
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
							{myItems.map(item => (
								<Card
									key={item.id}
									className="group overflow-hidden border-border/70 hover:border-primary/50 transition-all cursor-pointer"
									onClick={() => setSelectedItem(item)}
								>
									<div className="aspect-square relative overflow-hidden bg-muted">
										<img
											src={item.imageUrl}
											alt={item.name}
											className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
										/>
									</div>
									<CardContent className="p-4">
										<h3 className="font-semibold text-foreground truncate mb-1">{item.name}</h3>
										{item.circles.length > 0 && (
											<p className="text-sm text-muted-foreground truncate">
												{item.circles[0].name}
											</p>
										)}
									</CardContent>
								</Card>
							))}
						</div>
					)}
				</TabsContent>
			</Tabs>

			{/* Delete Confirmation Dialog */}
			<Dialog
				open={!!itemToDelete}
				onOpenChange={open => {
					if (!open) setItemToDelete(null);
				}}
			>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Delete Item</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete &quot;{itemToDelete?.name}&quot;? This action cannot be
							undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button variant="outline" onClick={() => setItemToDelete(null)} disabled={isDeletingItem}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleDelete} disabled={isDeletingItem}>
							{isDeletingItem ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Deleting...
								</>
							) : (
								'Delete'
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Modals */}
			<AddItemModal open={showAddItem} onOpenChange={setShowAddItem} onItemCreated={() => refetch()} />
			<ItemDetailsModal item={selectedItem} onOpenChange={open => !open && setSelectedItem(null)} />
		</div>
	);
}
