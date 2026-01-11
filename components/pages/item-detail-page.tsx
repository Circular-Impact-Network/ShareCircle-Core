'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
	ArrowLeft, 
	MessageCircle, 
	Calendar, 
	Tag, 
	FolderOpen, 
	ExternalLink, 
	Copy, 
	Check, 
	Loader2,
	Lock,
	X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { useGetItemQuery } from '@/lib/redux/api/itemsApi';
import { PageShell } from '@/components/ui/page';
import { useToast } from '@/hooks/use-toast';

interface ItemDetailPageProps {
	itemId: string;
}

export function ItemDetailPage({ itemId }: ItemDetailPageProps) {
	const router = useRouter();
	const { toast } = useToast();
	const [copied, setCopied] = useState(false);
	const { data: item, isLoading, error } = useGetItemQuery(itemId);

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		});
	};

	const handleCopyLink = async () => {
		const url = `${window.location.origin}/items/${itemId}`;
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
			toast({
				title: 'Link copied!',
				description: 'Share this link with circle members.',
			});
		} catch {
			toast({
				title: 'Failed to copy',
				description: 'Please copy the URL manually.',
				variant: 'destructive',
			});
		}
	};

	const handleOpenImage = () => {
		if (item?.imageUrl) {
			window.open(item.imageUrl, '_blank');
		}
	};

	const handleBack = () => {
		if (item?.isOwner) {
			router.push('/listings');
		} else {
			router.push('/browse');
		}
	};

	// Loading state
	if (isLoading) {
		return (
			<PageShell className="flex items-center justify-center min-h-[60vh]">
				<div className="text-center">
					<Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
					<p className="text-muted-foreground">Loading item details...</p>
				</div>
			</PageShell>
		);
	}

	// Access denied state (403)
	if (error && 'status' in error && error.status === 403) {
		return (
			<PageShell className="flex items-center justify-center min-h-[60vh]">
				<Card className="max-w-md w-full">
					<CardContent className="flex flex-col items-center text-center p-8">
						<div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
							<Lock className="h-8 w-8 text-destructive" />
						</div>
						<h2 className="text-xl font-semibold mb-2">Access Denied</h2>
						<p className="text-muted-foreground mb-6">
							You don&apos;t have access to this item. You must be a member of the circle this item belongs to.
						</p>
						<div className="flex flex-col gap-3 w-full">
							<Button 
								onClick={() => {
									console.log('[Access Request] User requested access to item:', itemId);
									toast({
										title: 'Access request logged',
										description: 'This feature is coming soon.',
									});
								}}
								className="w-full"
							>
								Request Access
							</Button>
							<Button 
								variant="outline" 
								onClick={() => router.push('/browse')}
								className="w-full gap-2"
							>
								<ArrowLeft className="h-4 w-4" />
								Go to Browse
							</Button>
						</div>
					</CardContent>
				</Card>
			</PageShell>
		);
	}

	// Not found or other error
	if (error || !item) {
		return (
			<PageShell className="flex items-center justify-center min-h-[60vh]">
				<Card className="max-w-md w-full">
					<CardContent className="flex flex-col items-center text-center p-8">
						<div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
							<X className="h-8 w-8 text-muted-foreground" />
						</div>
						<h2 className="text-xl font-semibold mb-2">Item Not Found</h2>
						<p className="text-muted-foreground mb-6">
							This item doesn&apos;t exist or may have been deleted.
						</p>
						<Button 
							variant="outline" 
							onClick={() => router.push('/browse')}
							className="gap-2"
						>
							<ArrowLeft className="h-4 w-4" />
							Go to Browse
						</Button>
					</CardContent>
				</Card>
			</PageShell>
		);
	}

	return (
		<PageShell className="space-y-6">
			{/* Header with Back Button and Share */}
			<div className="flex items-center justify-between">
				<Button onClick={handleBack} variant="ghost" className="gap-2">
					<ArrowLeft className="h-4 w-4" />
					Back
				</Button>
				<Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-2">
					{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
					{copied ? 'Copied!' : 'Copy Link'}
				</Button>
			</div>

			{/* Main Content */}
			<div className="grid gap-6 lg:grid-cols-2">
				{/* Image Section */}
				<div className="relative">
					<div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
						<img 
							src={item.imageUrl} 
							alt={item.name} 
							className="h-full w-full object-contain"
						/>
						{/* Your Item Badge - Left Side */}
						{item.isOwner && (
							<Badge className="absolute top-3 left-3 bg-primary/90 backdrop-blur-sm">
								Your Item
							</Badge>
						)}
					</div>
					{/* Open Image Button */}
					<Button 
						variant="outline" 
						size="sm" 
						className="mt-3 w-full gap-2"
						onClick={handleOpenImage}
					>
						<ExternalLink className="h-4 w-4" />
						Open Full Image
					</Button>
				</div>

				{/* Details Section */}
				<div className="space-y-6">
					{/* Title and Description */}
					<div>
						<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{item.name}</h1>
						{item.description && (
							<p className="mt-2 text-muted-foreground leading-relaxed">
								{item.description}
							</p>
						)}
					</div>

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
							<AvatarFallback className="text-sm">
								{item.owner.name?.[0]?.toUpperCase() || '?'}
							</AvatarFallback>
						</Avatar>
						<div className="space-y-0.5 flex-1">
							<p className="text-sm font-semibold leading-tight">
								{item.owner.name || 'Unknown'}
							</p>
							<div className="flex items-center gap-1 text-xs text-muted-foreground">
								<Calendar className="h-3 w-3" />
								<span>Added {formatDate(item.createdAt)}</span>
							</div>
						</div>
					</div>

					{/* Action Buttons */}
					<div className="flex gap-3 pt-2">
						<Button variant="outline" className="flex-1 gap-2 bg-transparent">
							<MessageCircle className="h-4 w-4" />
							Contact
						</Button>
						<Button className="flex-1">
							Request to Borrow
						</Button>
					</div>

					{/* Shareable Link Section */}
					<Card className="bg-muted/30">
						<CardContent className="p-4">
							<p className="text-xs text-muted-foreground mb-2">Shareable Link</p>
							<div className="flex items-center gap-2">
								<code className="flex-1 truncate rounded bg-background px-2 py-1 text-xs">
									{typeof window !== 'undefined' ? `${window.location.origin}/items/${itemId}` : `/items/${itemId}`}
								</code>
								<Button 
									variant="secondary" 
									size="sm" 
									onClick={handleCopyLink}
									className="shrink-0 gap-1"
								>
									{copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
									{copied ? 'Copied' : 'Copy'}
								</Button>
							</div>
							<p className="text-xs text-muted-foreground mt-2">
								Only circle members can view this item.
							</p>
						</CardContent>
					</Card>
				</div>
			</div>
		</PageShell>
	);
}
