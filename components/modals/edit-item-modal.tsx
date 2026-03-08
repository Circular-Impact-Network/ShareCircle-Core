'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Loader2, Plus, Upload, X } from 'lucide-react';
import {
	useCleanupImageMutation,
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
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import {
	MAX_MEDIA_ATTACHMENTS,
	MAX_UPLOAD_SIZE_BYTES,
	getUploadValidationError,
	prepareImageForUpload,
} from '@/lib/media';

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
	const [cleanupImage] = useCleanupImageMutation();
	const isDesktop = useMediaQuery('(min-width: 768px)');
	const isOnline = useOnlineStatus();
	const mainImageFileInputRef = useRef<HTMLInputElement>(null);
	const mainImageCameraInputRef = useRef<HTMLInputElement>(null);
	const mediaFileInputRef = useRef<HTMLInputElement>(null);
	const mediaCameraInputRef = useRef<HTMLInputElement>(null);
	const initialImagePathRef = useRef('');
	const initialMediaPathsRef = useRef<string[]>([]);

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
		initialImagePathRef.current = item.imagePath;
		initialMediaPathsRef.current = existingMediaPaths;
	}, [item, open]);

	useEffect(() => {
		return () => {
			if (savePhaseTimeoutRef.current) {
				clearTimeout(savePhaseTimeoutRef.current);
			}
		};
	}, []);

	const allCirclesSelected = useMemo(
		() => circles.length > 0 && selectedCircleIds.length === circles.length,
		[circles.length, selectedCircleIds.length],
	);

	const cleanupTemporaryUploads = useCallback(async () => {
		const cleanupTasks: Promise<unknown>[] = [];

		if (imagePath && imagePath !== initialImagePathRef.current) {
			cleanupTasks.push(
				cleanupImage({ path: imagePath, bucket: 'items' }).catch(error => {
					console.error('Failed to cleanup replaced image:', error);
				}),
			);
		}

		for (const entry of media) {
			if (!initialMediaPathsRef.current.includes(entry.path)) {
				cleanupTasks.push(
					cleanupImage({ path: entry.path, bucket: 'media' }).catch(error => {
						console.error('Failed to cleanup added media:', error);
					}),
				);
			}
		}

		await Promise.all(cleanupTasks);
	}, [cleanupImage, imagePath, media]);

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

	const prepareImageFile = async (file: File, allowVideo = false) => {
		if (!file) return;

		const typeError = getUploadValidationError(file, {
			allowVideo,
			maxSizeBytes: file.type.startsWith('image/') ? Number.MAX_SAFE_INTEGER : MAX_UPLOAD_SIZE_BYTES,
		});
		if (typeError) {
			toast({
				title: 'Unsupported media',
				description: typeError,
				variant: 'destructive',
			});
			return null;
		}

		const preparedFile = file.type.startsWith('image/')
			? await prepareImageForUpload(file)
			: file;
		const validationError = getUploadValidationError(preparedFile, { allowVideo });
		if (validationError) {
			toast({
				title: 'File too large',
				description: validationError,
				variant: 'destructive',
			});
			return null;
		}

		return preparedFile;
	};

	const handleMainImageFile = async (file: File) => {
		if (!isOnline) {
			toast({
				title: 'Connection required',
				description: 'You need to be online to replace the main image.',
				variant: 'destructive',
			});
			return;
		}

		const preparedFile = await prepareImageFile(file);
		if (!preparedFile) return;

		try {
			const previousImagePath = imagePath;
			const uploaded = await uploadItemImage(preparedFile).unwrap();
			setImagePath(uploaded.path);
			setImageUrl(uploaded.url);

			if (previousImagePath && previousImagePath !== initialImagePathRef.current) {
				await cleanupImage({ path: previousImagePath, bucket: 'items' }).catch(error => {
					console.error('Failed to cleanup previous replacement image:', error);
				});
			}
		} catch {
			toast({
				title: 'Upload failed',
				description: 'Could not upload item image.',
				variant: 'destructive',
			});
		}
	};

	const handleMainImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) {
			await handleMainImageFile(file);
		}
		event.target.value = '';
	};

	const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(event.target.files || []);
		if (files.length === 0) return;
		if (!isOnline) {
			toast({
				title: 'Connection required',
				description: 'You need to be online to upload additional media.',
				variant: 'destructive',
			});
			event.target.value = '';
			return;
		}

		if (media.length + files.length > MAX_MEDIA_ATTACHMENTS) {
			toast({
				title: 'Too many files',
				description: `You can upload up to ${MAX_MEDIA_ATTACHMENTS} additional media files.`,
				variant: 'destructive',
			});
			event.target.value = '';
			return;
		}

		try {
			const uploads: MediaEntry[] = [];
			for (const file of files) {
				const preparedFile = await prepareImageFile(file, true);
				if (!preparedFile) {
					continue;
				}

				const upload = await uploadMedia(preparedFile).unwrap();
				uploads.push({
					path: upload.path,
					url: upload.url,
				});
			}

			if (uploads.length === 0) {
				event.target.value = '';
				return;
			}

			setMedia(prev => [
				...prev,
				...uploads,
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

	const removeMediaEntry = async (entry: MediaEntry) => {
		if (!initialMediaPathsRef.current.includes(entry.path)) {
			await cleanupImage({ path: entry.path, bucket: 'media' }).catch(error => {
				console.error('Failed to cleanup added media:', error);
			});
		}

		setMedia(prev => prev.filter(existing => existing.path !== entry.path));
	};

	const handleCancel = async () => {
		await cleanupTemporaryUploads();
		onOpenChange(false);
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
		<Dialog
			open={open}
			onOpenChange={nextOpen => {
				if (!nextOpen) {
					void handleCancel();
					return;
				}
				onOpenChange(nextOpen);
			}}
		>
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
						{!isOnline && (
							<div className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/60 dark:text-amber-100">
								You&apos;re offline. Edits to images or media need a connection before they can be saved.
							</div>
						)}
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
								<img
									src={imageUrl}
									alt={name || 'Item image'}
									className="h-40 w-full rounded-md object-contain bg-muted"
								/>
							) : null}
							<input
								ref={mainImageFileInputRef}
								type="file"
								accept="image/*"
								className="hidden"
								onChange={handleMainImageUpload}
							/>
							<input
								ref={mainImageCameraInputRef}
								type="file"
								accept="image/*"
								capture="environment"
								className="hidden"
								onChange={handleMainImageUpload}
							/>
							<div className="flex flex-col gap-2 sm:flex-row">
								<Button
									type="button"
									variant="outline"
									className="gap-2"
									disabled={isUploadingImage}
									onClick={() => mainImageFileInputRef.current?.click()}
								>
									<Upload className="h-4 w-4" />
									{isUploadingImage ? 'Uploading...' : 'Choose photo'}
								</Button>
								{!isDesktop && (
									<Button
										type="button"
										variant="outline"
										className="gap-2"
										disabled={isUploadingImage}
										onClick={() => mainImageCameraInputRef.current?.click()}
									>
										<Camera className="h-4 w-4" />
										Take photo
									</Button>
								)}
							</div>
						</div>

						<div className="space-y-2">
							<Label>Additional media (max 5)</Label>
							<div className="grid grid-cols-2 gap-2">
								{media.map(entry => (
									<div key={entry.path} className="relative rounded-md border p-1">
										{entry.url.match(/\.(mp4|webm|mov)(\?|$)/i) ? (
											<video
												src={entry.url}
												className="h-24 w-full rounded object-cover"
												muted
												playsInline
											/>
										) : (
											<img
												src={entry.url}
												alt="Additional media"
												className="h-24 w-full rounded object-cover"
											/>
										)}
										<Button
											variant="destructive"
											size="icon"
											className="absolute right-1 top-1 h-6 w-6"
											onClick={() => void removeMediaEntry(entry)}
										>
											<X className="h-3 w-3" />
										</Button>
									</div>
								))}
							</div>
							{media.length < MAX_MEDIA_ATTACHMENTS && (
								<>
									<input
										ref={mediaFileInputRef}
										type="file"
										accept="image/*,video/*"
										multiple
										className="hidden"
										onChange={handleMediaUpload}
									/>
									<input
										ref={mediaCameraInputRef}
										type="file"
										accept="image/*"
										capture="environment"
										className="hidden"
										onChange={handleMediaUpload}
									/>
									<div className="flex flex-col gap-2 sm:flex-row">
										<Button
											type="button"
											variant="outline"
											className="gap-2"
											disabled={isUploadingMedia}
											onClick={() => mediaFileInputRef.current?.click()}
										>
											<Plus className="h-4 w-4" />
											{isUploadingMedia ? 'Uploading...' : 'Add media'}
										</Button>
										{!isDesktop && (
											<Button
												type="button"
												variant="outline"
												className="gap-2"
												disabled={isUploadingMedia}
												onClick={() => mediaCameraInputRef.current?.click()}
											>
												<Camera className="h-4 w-4" />
												Take photo
											</Button>
										)}
									</div>
								</>
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
					<Button variant="outline" onClick={() => void handleCancel()}>
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
