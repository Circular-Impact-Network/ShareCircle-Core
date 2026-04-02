'use client';

import type { ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ItemCard } from '@/components/cards/item-card';
import type { Item } from '@/lib/redux/api/itemsApi';
import { cn } from '@/lib/utils';

type ItemSummaryCardProps = {
	item: Item;
	onClick?: (item: Item) => void;
	actions?: ReactNode;
	className?: string;
	showMediaActions?: boolean;
	onEdit?: (item: Item) => void;
	onDelete?: (item: Item) => void;
	descriptionFallback?: string;
	borrowStatus?: string | null;
};

export function ItemSummaryCard({
	item,
	onClick,
	actions,
	className,
	showMediaActions = false,
	onEdit,
	onDelete,
	descriptionFallback = 'No description provided.',
	borrowStatus,
}: ItemSummaryCardProps) {
	const visibleTags = item.tags.slice(0, 2);
	const remainingTags = item.tags.length - visibleTags.length;
	const circleNames = item.circles.map(circle => circle.name).join(', ');

	return (
		<Card
			className={cn(
				'group flex h-full flex-col overflow-hidden border-border/70 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg',
				onClick && 'cursor-pointer',
				className,
			)}
			onClick={() => onClick?.(item)}
		>
			<ItemCard
				item={item}
				variant="grid"
				showActions={showMediaActions}
				onEdit={onEdit}
				onDelete={onDelete}
				className="aspect-[4/3]"
			/>
			<CardContent className="flex flex-1 flex-col gap-3 p-4">
				<div className="space-y-2">
					<div className="flex items-center gap-2">
						<h3 className="line-clamp-1 text-base font-semibold text-foreground">{item.name}</h3>
						{borrowStatus && (
							<Badge variant="secondary" className="shrink-0 text-[10px]">
								{borrowStatus}
							</Badge>
						)}
						{item.isAvailable === false && !borrowStatus && (
							<Badge variant="outline" className="shrink-0 text-[10px] text-amber-600">
								Borrowed
							</Badge>
						)}
					</div>
					<p className="line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
						{item.description || descriptionFallback}
					</p>
				</div>

				<div className="flex min-h-6 items-center gap-1 overflow-hidden">
					{visibleTags.length > 0 ? (
						<>
							{visibleTags.map(tag => (
								<Badge key={tag} variant="secondary" className="max-w-[7rem] truncate text-xs">
									{tag}
								</Badge>
							))}
							{remainingTags > 0 ? (
								<Badge variant="outline" className="shrink-0 text-xs">
									+{remainingTags}
								</Badge>
							) : null}
						</>
					) : (
						<span className="text-xs text-muted-foreground">No tags</span>
					)}
				</div>

				<div className="flex min-h-6 items-center gap-2 text-sm text-muted-foreground">
					<Avatar className="h-5 w-5">
						<AvatarImage src={item.owner.image || undefined} />
						<AvatarFallback className="text-[10px]">
							{item.owner.name?.[0]?.toUpperCase() || '?'}
						</AvatarFallback>
					</Avatar>
					<span className="truncate">{item.owner.name || 'Unknown'}</span>
					{item.isOwner ? (
						<Badge variant="outline" className="shrink-0 text-[10px]">
							You
						</Badge>
					) : null}
				</div>

				<div className="min-h-5 text-xs text-muted-foreground">
					<span className="line-clamp-1">{circleNames || 'Not shared to circles yet'}</span>
				</div>

				<div className="mt-auto min-h-9">{actions}</div>
			</CardContent>
		</Card>
	);
}
