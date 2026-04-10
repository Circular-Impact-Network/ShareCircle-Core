'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, ArchiveRestore, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { ItemGridSkeleton } from '@/components/ui/skeletons';
import { Button } from '@/components/ui/button';
import { AddItemModal } from '@/components/modals/add-item-modal';
import { EditItemModal } from '@/components/modals/edit-item-modal';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { ItemSummaryCard } from '@/components/cards/item-summary-card';
import { PageTabs, PageTabsContent, PageTabsList, PageTabsTrigger } from '@/components/ui/app-tabs';
import { InfiniteScrollSentinel } from '@/components/ui/infinite-scroll-sentinel';
import { useGetAllItemsQuery, useDeleteItemMutation, useUpdateItemMutation, Item } from '@/lib/redux/api/itemsApi';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, PageShell, PageStickyHeader } from '@/components/ui/page';
import { EmptyState } from '@/components/ui/empty-state';
import { useProgressivePagination } from '@/hooks/use-progressive-pagination';

type ListingTab = 'active' | 'archived';

export function MyListingsPage() {
	const router = useRouter();
	const { toast } = useToast();
	const [activeTab, setActiveTab] = useState<ListingTab>('active');
	const [showAddItem, setShowAddItem] = useState(false);
	const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
	const [itemToEdit, setItemToEdit] = useState<Item | null>(null);
	const [actionItemId, setActionItemId] = useState<string | null>(null);

	const {
		data: myItems = [],
		isLoading,
	} = useGetAllItemsQuery({
		ownerOnly: true,
		includeArchived: true,
	});
	const [deleteItem, { isLoading: isDeletingItem }] = useDeleteItemMutation();
	const [updateItem] = useUpdateItemMutation();

	const activeItems = myItems.filter(item => !item.archivedAt);
	const archivedItems = myItems.filter(item => Boolean(item.archivedAt));
	const {
		visibleItems: visibleActiveItems,
		hasMore: hasMoreActiveItems,
		loadMore: loadMoreActiveItems,
	} = useProgressivePagination({ items: activeItems, pageSize: 12 });
	const {
		visibleItems: visibleArchivedItems,
		hasMore: hasMoreArchivedItems,
		loadMore: loadMoreArchivedItems,
	} = useProgressivePagination({ items: archivedItems, pageSize: 12 });

	const handleDelete = async () => {
		if (!itemToDelete) return;

		try {
			await deleteItem(itemToDelete.id).unwrap();
			toast({
				title: 'Item deleted',
				description: `${itemToDelete.name} has been deleted permanently.`,
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

	const handleArchiveToggle = async (item: Item, archived: boolean) => {
		setActionItemId(item.id);
		try {
			await updateItem({ id: item.id, archived }).unwrap();
			toast({
				title: archived ? 'Item archived' : 'Item restored',
				description: archived ? `${item.name} moved to Archived.` : `${item.name} is active again.`,
			});
		} catch (error) {
			console.error('Failed to update archive state:', error);
			toast({
				title: 'Unable to update listing',
				description: 'Please try again.',
				variant: 'destructive',
			});
		} finally {
			setActionItemId(null);
		}
	};

	const renderItemActions = (item: Item, archived: boolean) => (
		<div
			className="flex flex-wrap gap-2"
			onClick={event => {
				event.stopPropagation();
			}}
		>
			{!archived && (
				<Button
					variant="outline"
					size="sm"
					className="gap-2"
					onClick={() => setItemToEdit(item)}
					disabled={archived}
				>
					<Pencil className="h-4 w-4" />
					Edit
				</Button>
			)}
			<Button
				variant="outline"
				size="sm"
				className="gap-2"
				onClick={() => handleArchiveToggle(item, !archived)}
				disabled={actionItemId === item.id}
			>
				{actionItemId === item.id ? (
					<Loader2 className="h-4 w-4 animate-spin" />
				) : archived ? (
					<ArchiveRestore className="h-4 w-4" />
				) : (
					<Archive className="h-4 w-4" />
				)}
				{archived ? 'Unarchive' : 'Archive'}
			</Button>
			<Button
				variant="outline"
				size="sm"
				className="gap-2 text-destructive"
				onClick={() => setItemToDelete(item)}
			>
				<Trash2 className="h-4 w-4" />
				Delete
			</Button>
		</div>
	);

	return (
		<PageShell>
			<PageTabs value={activeTab} onValueChange={value => setActiveTab(value as ListingTab)}>
				<PageStickyHeader className="pt-5 sm:pt-6 lg:pt-7 pb-3 space-y-4">
					<PageHeader
						title="My Listings"
						description="Manage the items you share with your circles."
						actions={
							<Button onClick={() => setShowAddItem(true)} className="gap-2">
								<Plus className="h-4 w-4" />
								<span className="hidden sm:inline">Add Item</span>
								<span className="sm:hidden">Add</span>
							</Button>
						}
					/>
					<PageTabsList>
					<PageTabsTrigger value="active" badge={activeItems.length > 0 ? activeItems.length : undefined}>
						Active
					</PageTabsTrigger>
					<PageTabsTrigger
						value="archived"
						badge={archivedItems.length > 0 ? archivedItems.length : undefined}
					>
						Archived
					</PageTabsTrigger>
				</PageTabsList>
				</PageStickyHeader>

				<PageTabsContent value="active">
					{isLoading ? (
						<ItemGridSkeleton count={6} />
					) : activeItems.length === 0 ? (
						<EmptyState
							title="No active listings"
							description="Create a listing to start sharing items with your circles."
							action={
								<Button onClick={() => setShowAddItem(true)} className="gap-2">
									<Plus className="h-4 w-4" />
									Add your first item
								</Button>
							}
						/>
					) : (
						<>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
								{visibleActiveItems.map(item => (
									<ItemSummaryCard
										key={item.id}
										item={item}
										onClick={() => router.push(`/items/${item.id}`)}
										showMediaActions
										onEdit={setItemToEdit}
										actions={renderItemActions(item, false)}
									/>
								))}
							</div>
							<InfiniteScrollSentinel
								hasMore={hasMoreActiveItems}
								onLoadMore={loadMoreActiveItems}
								enabled={activeTab === 'active'}
								label="Loading more active listings"
							/>
						</>
					)}
				</PageTabsContent>

				<PageTabsContent value="archived">
					{isLoading ? (
						<ItemGridSkeleton count={6} />
					) : archivedItems.length === 0 ? (
						<EmptyState
							title="No archived listings"
							description="Archived items stay here until you restore or delete them."
						/>
					) : (
						<>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
								{visibleArchivedItems.map(item => (
									<ItemSummaryCard
										key={item.id}
										item={item}
										onClick={() => router.push(`/items/${item.id}`)}
										showMediaActions
										actions={renderItemActions(item, true)}
										className="border-border/60 bg-muted/10"
									/>
								))}
							</div>
							<InfiniteScrollSentinel
								hasMore={hasMoreArchivedItems}
								onLoadMore={loadMoreArchivedItems}
								enabled={activeTab === 'archived'}
								label="Loading more archived listings"
							/>
						</>
					)}
				</PageTabsContent>
			</PageTabs>

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
							Delete &quot;{itemToDelete?.name}&quot; permanently? This cannot be undone.
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
								'Delete permanently'
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AddItemModal open={showAddItem} onOpenChange={setShowAddItem} />
			<EditItemModal
				itemId={itemToEdit?.id || null}
				open={!!itemToEdit}
				onOpenChange={open => {
					if (!open) setItemToEdit(null);
				}}
				onSuccess={() => setItemToEdit(null)}
			/>
		</PageShell>
	);
}
