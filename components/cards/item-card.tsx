'use client';

import { memo } from 'react';
import { ExternalLink, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselPrevious,
	CarouselNext,
	CarouselDots,
	CarouselNumber,
} from '@/components/ui/carousel';
import { Item } from '@/lib/redux/api/itemsApi';
import { cn } from '@/lib/utils';

export interface ItemCardProps {
	item: Item;
	variant?: 'grid' | 'list' | 'detail';
	showActions?: boolean;
	onDelete?: (item: Item) => void;
	onClick?: (item: Item) => void;
	className?: string;
}

export const ItemCard = memo(function ItemCard({ item, variant = 'grid', showActions = false, onDelete, onClick, className }: ItemCardProps) {
	// Determine if we should show carousel (always show if multiple images, or if detail variant)
	const hasMultipleMedia = item.mediaUrls && item.mediaUrls.length > 1;
	const shouldShowCarousel = hasMultipleMedia || variant === 'detail';
	const mediaUrls = item.mediaUrls && item.mediaUrls.length > 0 ? item.mediaUrls : [item.imageUrl];

	// Variant-specific classes
	const containerClasses = cn(
		'relative overflow-hidden bg-muted',
		{
			'aspect-square': variant === 'grid' || variant === 'detail',
			'w-20 h-20 rounded-lg flex-shrink-0': variant === 'list',
		},
		className,
	);

	const handleCardClick = () => {
		if (onClick) {
			onClick(item);
		}
	};

	const handleDeleteClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (onDelete) {
			onDelete(item);
		}
	};

	const handleExternalLinkClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		const urlToOpen = item.mediaUrls && item.mediaUrls.length > 0 ? item.mediaUrls[0] : item.imageUrl;
		window.open(urlToOpen, '_blank');
	};

	const renderMedia = (url: string, index: number) => {
		const isVideo = url.includes('video') || url.match(/\.(mp4|webm|mov)$/i);
		
		if (isVideo) {
			return (
				<video
					src={url}
					className="w-full h-full object-contain"
					muted
					playsInline
					autoPlay
					loop
					preload="metadata"
				/>
			);
		}

		return (
			<img
				src={url}
				alt={`${item.name}${index > 0 ? ` - ${index + 1}` : ''}`}
				className="w-full h-full object-contain"
				loading="lazy"
				decoding="async"
			/>
		);
	};

	return (
		<div className={containerClasses} onClick={handleCardClick}>
			{shouldShowCarousel && hasMultipleMedia ? (
				<Carousel className="w-full h-full group" opts={{ loop: true }}>
					<CarouselContent className="h-full -ml-0">
						{mediaUrls.map((url, index) => (
							<CarouselItem key={index} className="h-full pl-0">
								<div className="relative h-full w-full flex items-center justify-center">
									{renderMedia(url, index)}
								</div>
							</CarouselItem>
						))}
					</CarouselContent>
					<CarouselPrevious />
					<CarouselNext />
					{variant !== 'list' && (
						<>
							<CarouselDots className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10" />
							<CarouselNumber className="z-10" />
						</>
					)}
					{/* Badges and Actions */}
					{item.isOwner && variant !== 'list' && (
						<Badge className="absolute top-2 left-2 bg-primary/90 backdrop-blur-sm z-10">
							Your Item
						</Badge>
					)}
					{showActions && variant !== 'list' && (
						<div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 bg-white rounded-full shadow-md"
								onClick={handleExternalLinkClick}
							>
								<ExternalLink className="h-4 w-4 text-black" />
							</Button>
							{onDelete && item.isOwner && (
								<Button
									variant="secondary"
									size="icon"
									className="h-8 w-8 bg-background/80 backdrop-blur-sm"
									onClick={handleDeleteClick}
								>
									<Trash2 className="h-4 w-4 text-destructive" />
								</Button>
							)}
						</div>
					)}
				</Carousel>
			) : (
				<div className="w-full h-full flex items-center justify-center">
					{renderMedia(mediaUrls[0], 0)}
					{/* Badges and Actions for single image */}
					{item.isOwner && variant !== 'list' && (
						<Badge className="absolute top-2 left-2 bg-primary/90 backdrop-blur-sm z-10">
							Your Item
						</Badge>
					)}
					{showActions && variant !== 'list' && (
						<div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 bg-white rounded-full shadow-md"
								onClick={handleExternalLinkClick}
							>
								<ExternalLink className="h-4 w-4 text-black" />
							</Button>
							{onDelete && item.isOwner && (
								<Button
									variant="secondary"
									size="icon"
									className="h-8 w-8 bg-background/80 backdrop-blur-sm"
									onClick={handleDeleteClick}
								>
									<Trash2 className="h-4 w-4 text-destructive" />
								</Button>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
});
