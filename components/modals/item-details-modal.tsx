'use client';

import { MessageCircle, Calendar, Tag, FolderOpen } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Item } from '@/lib/redux/api/itemsApi';

interface ItemDetailsModalProps {
	item: Item | null;
	onOpenChange: (open: boolean) => void;
}

export function ItemDetailsModal({ item, onOpenChange }: ItemDetailsModalProps) {
	if (!item) return null;

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		});
	};

	return (
		<Dialog open={!!item} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg overflow-hidden p-0">
				{/* Item Image */}
				<div className="relative h-64 w-full overflow-hidden bg-muted">
					<img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
					{item.isOwner && (
						<Badge className="absolute top-3 right-3 bg-primary/90 backdrop-blur-sm">Your Item</Badge>
					)}
				</div>

				<div className="space-y-5 px-6 pb-6 pt-4">
					<DialogHeader className="items-start text-left space-y-2">
						<DialogTitle className="text-2xl">{item.name}</DialogTitle>
						{item.description && (
							<DialogDescription className="text-base leading-relaxed text-muted-foreground">
								{item.description}
							</DialogDescription>
						)}
					</DialogHeader>

					{/* Categories */}
					{item.categories && item.categories.length > 0 && (
						<div className="flex items-center gap-2 flex-wrap">
							<FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
							{item.categories.map(category => (
								<Badge key={category} variant="secondary">
									{category}
								</Badge>
							))}
						</div>
					)}

					{/* Tags */}
					{item.tags && item.tags.length > 0 && (
						<div className="flex items-center gap-2 flex-wrap">
							<Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
							<div className="flex flex-wrap gap-1.5">
								{item.tags.map(tag => (
									<Badge key={tag} variant="outline" className="text-xs">
										{tag}
									</Badge>
								))}
							</div>
						</div>
					)}

					{/* Shared in Circles */}
					{item.circles && item.circles.length > 0 && (
						<div className="text-sm text-muted-foreground">
							Shared in: {item.circles.map(c => c.name).join(', ')}
						</div>
					)}

					<Separator />

					{/* Owner Info */}
					<div className="flex items-center gap-3">
						<Avatar className="h-12 w-12">
							<AvatarImage src={item.owner.image || undefined} />
							<AvatarFallback className="text-sm">{item.owner.name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
						</Avatar>
						<div className="space-y-0.5 flex-1">
							<p className="text-sm font-semibold leading-tight">{item.owner.name || 'Unknown'}</p>
							<div className="flex items-center gap-1 text-xs text-muted-foreground">
								<Calendar className="h-3 w-3" />
								<span>Added {formatDate(item.createdAt)}</span>
							</div>
						</div>
					</div>

					{/* Action Buttons */}
					<div className="flex gap-3 pt-2">
						<Button variant="outline" className="flex-1 gap-2 bg-transparent" onClick={() => onOpenChange(false)}>
							<MessageCircle className="h-4 w-4" />
							Contact
						</Button>
						<Button className="flex-1" onClick={() => onOpenChange(false)}>
							Request to Borrow
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
