'use client';

// Edit item name, description, categories, tags, main image, extra media, circles
import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import {
	useGetItemQuery,
	useUpdateItemMutation,
	useUploadItemImageMutation,
	useUploadMediaMutation,
} from '@/lib/redux/api/itemsApi';
import { useGetCirclesQuery } from '@/lib/redux/api/circlesApi';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

type EditItemModalProps = {
	itemId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: () => void;
};

type MediaEntry = {
	path: string;
	url: string;
};

export function EditItemModal({ itemId, open, onOpenChange, onSuccess }: EditItemModalProps) {
	const { toast } = useToast();
	const { data: item, isLoading: isLoadingItem } = useGetItemQuery(itemId || '', { skip: !itemId || !open });
	const { data: circles = [] } = useGetCirclesQuery(undefined, { skip: !open });
	const [updateItem, { isLoading: isUpdating }] = useUpdateItemMutation();
	const [uploadItemImage, { isLoading: isUploadingImage }] = useUploadItemImageMutation();
	const [uploadMedia, { isLoading: isUploadingMedia }] = useUploadMediaMutation();

	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [categoriesText, setCategoriesText] = useState('');
	const [tagsText, setTagsText] = useState('');
	const [selectedCircleIds, setSelectedCircleIds] = useState<string[]>([]);
	const [imagePath, setImagePath] = useState('');
	const [imageUrl, setImageUrl] = useState('');
	const [media, setMedia] = useState<MediaEntry[]>([]);
	const savePhaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [savePhase, setSavePhase] = useState<'idle' | 'validating' | 'saving'>('idle');

	useEffect(() => {
		if (!item || !open) return;
		setName(item.name);
		setDescription(item.description || '');
		setCategoriesText(item.categories.join(', '));
		setTagsText(item.tags.join(', '));
		setSelectedCircleIds(item.circles.map(circle => circle.id));
		setImagePath(item.imagePath);
		setImageUrl(item.imageUrl);

		const existingMediaPaths = item.mediaPaths || [];
		const existingMediaUrls = (item.mediaUrls || []).slice(1);
		setMedia(
			existingMediaPaths.map((path, index) => ({
				path,
				url: existingMediaUrls[index] || '',
			})),
		);
	}, [item, open]);

	const allCirclesSelected = useMemo(
		() => circles.length > 0 && selectedCircleIds.length === circles.length,
		[circles.length, selectedCircleIds.length],
	);

	const toggleCircle = (circleId: string) => {
		setSelectedCircleIds(prev =>
			prev.includes(circleId) ? prev.filter(id => id !== circleId) : [...prev, circleId],
		);
	};

	const toggleSelectAllCircles = () => {
		if (allCirclesSelected) {
			setSelectedCircleIds([]);
			return;
		}
		setSelectedCircleIds(circles.map(circle => circle.id));
	};

	const handleMainImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		try {
			const uploaded = await uploadItemImage(file).unwrap();
			setImagePath(uploaded.path);
			setImageUrl(uploaded.url);
		} catch {
			toast({
				title: 'Upload failed',
				description: 'Could not upload item image.',
				variant: 'destructive',
			});
		} finally {
			event.target.value = '';
		}
	};

	const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(event.target.files || []);
		if (files.length === 0) return;

		if (media.length + files.length > 5) {
			toast({
				title: 'Too many files',
				description: 'You can upload up to 5 additional media files.',
				variant: 'destructive',
			});
			event.target.value = '';
			return;
		}

		try {
			const uploads = await Promise.all(files.map(file => uploadMedia(file).unwrap()));
			setMedia(prev => [
				...prev,
				...uploads.map(upload => ({
					path: upload.path,
					url: upload.url,
				})),
			]);
		} catch {
			toast({
				title: 'Upload failed',
				description: 'Could not upload one or more media files.',
				variant: 'destructive',
			});
		} finally {
			event.target.value = '';
		}
	};

	const handleSave = async () => {
		if (!itemId) return;
		if (!name.trim()) {
			toast({ title: 'Item name is required', variant: 'destructive' });
			return;
		}
		if (!imagePath) {
			toast({ title: 'Item image is required', variant: 'destructive' });
			return;
		}
		if (selectedCircleIds.length === 0) {
			toast({ title: 'Select at least one circle', variant: 'destructive' });
			return;
		}

		const categories = categoriesText
			.split(',')
			.map(value => value.trim())
			.filter(Boolean);
		const tags = tagsText
			.split(',')
			.map(value => value.trim())
			.filter(Boolean);

		if (savePhaseTimeoutRef.current) {
			clearTimeout(savePhaseTimeoutRef.current);
			savePhaseTimeoutRef.current = null;
		}
		setSavePhase('validating');
		savePhaseTimeoutRef.current = setTimeout(() => setSavePhase('saving'), 1500);

		try {
			await updateItem({
				id: itemId,
				name: name.trim(),
				description: description.trim() || '',
				imagePath,
				imageUrl,
				mediaPaths: media.map(entry => entry.path),
				categories,
				tags,
				circleIds: selectedCircleIds,
			}).unwrap();

			if (savePhaseTimeoutRef.current) {
				clearTimeout(savePhaseTimeoutRef.current);
				savePhaseTimeoutRef.current = null;
			}
			setSavePhase('idle');
			toast({ title: 'Listing updated', description: 'Your changes have been saved.' });
			onOpenChange(false);
			onSuccess?.();
		} catch (error) {
			if (savePhaseTimeoutRef.current) {
				clearTimeout(savePhaseTimeoutRef.current);
				savePhaseTimeoutRef.current = null;
			}
			const errData = error && typeof error === 'object' && 'data' in error ? (error.data as { code?: string; message?: string; error?: string; details?: { imageLabel: string; reason: string; detectedItems?: string[] }[] }) : null;
			if (errData?.code === 'ITEM_MISMATCH') {
				setSavePhase('validating');
				setTimeout(() => setSavePhase('idle'), 600);
				const detailLines = (errData.details ?? []).map(
					d => `${d.imageLabel}: ${d.reason}${d.detectedItems?.length ? ` (Detected: ${d.detectedItems.slice(0, 5).join(', ')}${d.detectedItems.length > 5 ? '…' : ''})` : ''}`,
				);
				toast({
					title: errData.message ?? 'Listing does not match photo(s)',
					description: detailLines.length > 0 ? detailLines.join('\n') : undefined,
					variant: 'destructive',
				});
			} else {
				setSavePhase('idle');
				const errorMessage = errData?.error ?? 'Failed to update listing';
				toast({ title: 'Update failed', description: errorMessage, variant: 'destructive' });
			}
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Edit Listing</DialogTitle>
					<DialogDescription>Update your item details, circles, and media.</DialogDescription>
				</DialogHeader>

				{isLoadingItem ? (
					<div className="flex items-center justify-center py-10">
						<Loader2 className="h-6 w-6 animate-spin text-primary" />
					</div>
				) : (
					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="edit-name">Item name</Label>
							<Input id="edit-name" value={name} onChange={event => setName(event.target.value)} />
						</div>

						<div className="space-y-2">
							<Label htmlFor="edit-description">Description</Label>
							<Textarea
								id="edit-description"
								value={description}
								onChange={event => setDescription(event.target.value)}
								rows={4}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="edit-categories">Categories (comma separated)</Label>
							<Input
								id="edit-categories"
								value={categoriesText}
								onChange={event => setCategoriesText(event.target.value)}
								placeholder="Tools, Home, Electronics"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="edit-tags">Tags (comma separated)</Label>
							<Input
								id="edit-tags"
								value={tagsText}
								onChange={event => setTagsText(event.target.value)}
								placeholder="cordless, compact, beginner"
							/>
						</div>

						<div className="space-y-2">
							<Label>Main image</Label>
							{imageUrl ? (
								<img src={imageUrl} alt={name || 'Item image'} className="h-40 w-full rounded-md object-contain bg-muted" />
							) : null}
							<label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
								<Upload className="h-4 w-4" />
								{isUploadingImage ? 'Uploading...' : 'Replace main image'}
								<input type="file" accept="image/*" className="hidden" onChange={handleMainImageUpload} />
							</label>
						</div>

						<div className="space-y-2">
							<Label>Additional media (max 5)</Label>
							<div className="grid grid-cols-2 gap-2">
								{media.map(entry => (
									<div key={entry.path} className="relative rounded-md border p-1">
										<img src={entry.url} alt="Additional media" className="h-24 w-full rounded object-cover" />
										<Button
											variant="destructive"
											size="icon"
											className="absolute right-1 top-1 h-6 w-6"
											onClick={() => setMedia(prev => prev.filter(existing => existing.path !== entry.path))}
										>
											<X className="h-3 w-3" />
										</Button>
									</div>
								))}
							</div>
							{media.length < 5 && (
								<label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
									<Upload className="h-4 w-4" />
									{isUploadingMedia ? 'Uploading...' : 'Add media'}
									<input type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleMediaUpload} />
								</label>
							)}
						</div>

						<div className="space-y-2">
							<Label>Share with circles</Label>
							{circles.length > 1 && (
								<Button variant="outline" type="button" onClick={toggleSelectAllCircles}>
									{allCirclesSelected ? 'Deselect All Circles' : 'Select All Circles'}
								</Button>
							)}
							<div className="app-scrollbar app-scrollbar-thin max-h-40 space-y-2 overflow-auto rounded-md border p-2">
								{circles.map(circle => {
									const selected = selectedCircleIds.includes(circle.id);
									return (
										<button
											key={circle.id}
											type="button"
											onClick={() => toggleCircle(circle.id)}
											className={`w-full rounded px-2 py-2 text-left text-sm ${
												selected ? 'bg-primary/10' : 'hover:bg-muted'
											}`}
										>
											{circle.name}
										</button>
									);
								})}
							</div>
						</div>
					</div>
				)}

				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={isUpdating || isUploadingImage || isUploadingMedia || isLoadingItem || savePhase !== 'idle'}>
						{isUpdating || savePhase !== 'idle' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
						{savePhase === 'validating' ? 'Validating...' : savePhase === 'saving' ? 'Saving...' : 'Save changes'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
