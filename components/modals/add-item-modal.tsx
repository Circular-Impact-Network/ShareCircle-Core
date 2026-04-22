'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dropzone } from '@/components/ui/dropzone';
import { Upload, Camera, Loader2, Sparkles, X, Check, ImageIcon, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import {
	useUploadItemImageMutation,
	useUploadMediaMutation,
	useAnalyzeImageMutation,
	useDetectItemsMutation,
	useCreateItemMutation,
	useCleanupImageMutation,
	type DetectedItem,
} from '@/lib/redux/api/itemsApi';
import {
	MAX_MEDIA_ATTACHMENTS,
	MAX_UPLOAD_SIZE_BYTES,
	getUploadValidationError,
	prepareImageForUpload,
} from '@/lib/media';

type ModalState = 'capture' | 'uploading' | 'detecting' | 'selecting' | 'analyzing' | 'editing' | 'saving';

interface Circle {
	id: string;
	name: string;
	avatarUrl?: string | null;
}

interface AddItemModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	currentCircleId?: string;
	onItemCreated?: () => void;
}

export function AddItemModal({ open, onOpenChange, currentCircleId, onItemCreated }: AddItemModalProps) {
	const { toast } = useToast();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const cameraInputRef = useRef<HTMLInputElement>(null);
	const supportingMediaRef = useRef<Array<{ path: string; url: string; preview: string; type: string }>>([]);

	// State
	const [state, setState] = useState<ModalState>('capture');
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const [imagePath, setImagePath] = useState<string | null>(null);
	const [imageUrl, setImageUrl] = useState<string | null>(null);
	const isDesktop = useMediaQuery('(min-width: 768px)');
	const isOnline = useOnlineStatus();

	// Option 1 & 2 flow states
	const [manualMode, setManualMode] = useState(false); // Toggle for Option 1 vs Option 2
	const [userHint, setUserHint] = useState(''); // Option 1: User-provided hint
	const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]); // Option 2: Detected items
	const [selectedItemName, setSelectedItemName] = useState<string | null>(null); // Option 2: Selected item
	const [manualItemName, setManualItemName] = useState(''); // Option 2: Manual entry fallback

	// Form state
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [categories, setCategories] = useState<string[]>([]);
	const [categoryInput, setCategoryInput] = useState('');
	const [tags, setTags] = useState<string[]>([]);
	const [tagInput, setTagInput] = useState('');
	const [selectedCircleIds, setSelectedCircleIds] = useState<string[]>([]);

	// Circles state
	const [circles, setCircles] = useState<Circle[]>([]);
	const [isLoadingCircles, setIsLoadingCircles] = useState(false);

	// Supporting media state
	const [supportingMedia, setSupportingMedia] = useState<
		Array<{ path: string; url: string; preview: string; type: string }>
	>([]);
	const supportingMediaInputRef = useRef<HTMLInputElement>(null);
	const savePhaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [savePhase, setSavePhase] = useState<'idle' | 'validating' | 'saving'>('idle');

	// RTK Query mutations
	const [uploadImage] = useUploadItemImageMutation();
	const [uploadMedia] = useUploadMediaMutation();
	const [analyzeImage, { isLoading: isAnalyzing }] = useAnalyzeImageMutation();
	const [detectItems] = useDetectItemsMutation();
	const [createItem, { isLoading: isSaving }] = useCreateItemMutation();
	const [cleanupImage] = useCleanupImageMutation();

	const revokePreviewUrl = useCallback((preview: string) => {
		if (preview.startsWith('blob:')) {
			URL.revokeObjectURL(preview);
		}
	}, []);

	const clearSupportingMedia = useCallback(
		(entries: Array<{ path: string; url: string; preview: string; type: string }>) => {
			entries.forEach(entry => revokePreviewUrl(entry.preview));
		},
		[revokePreviewUrl],
	);

	const cleanupTemporaryUploads = useCallback(async () => {
		const cleanupTasks: Promise<unknown>[] = [];

		if (imagePath) {
			cleanupTasks.push(
				cleanupImage({ path: imagePath, bucket: 'items' }).catch(error => {
					console.error('Failed to cleanup image:', error);
				}),
			);
		}

		for (const media of supportingMediaRef.current) {
			cleanupTasks.push(
				cleanupImage({ path: media.path, bucket: 'media' }).catch(error => {
					console.error('Failed to cleanup media:', error);
				}),
			);
		}

		await Promise.all(cleanupTasks);
	}, [cleanupImage, imagePath]);

	// Fetch circles when modal opens
	useEffect(() => {
		if (open) {
			fetchCircles();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const fetchCircles = async () => {
		try {
			setIsLoadingCircles(true);
			const response = await fetch('/api/circles');
			if (!response.ok) throw new Error('Failed to fetch circles');
			const data = await response.json();
			setCircles(data);

			// Pre-select current circle if provided
			if (currentCircleId) {
				setSelectedCircleIds([currentCircleId]);
			} else if (data.length > 0) {
				// If no current circle, select the first one by default
				setSelectedCircleIds([data[0].id]);
			}
		} catch (error) {
			console.error('Failed to fetch circles:', error);
			toast({
				title: 'Error',
				description: 'Failed to load circles',
				variant: 'destructive',
			});
		} finally {
			setIsLoadingCircles(false);
		}
	};

	// Reset state when modal closes
	const resetState = useCallback(() => {
		setState('capture');
		setImagePreview(null);
		setImagePath(null);
		setImageUrl(null);
		setName('');
		setDescription('');
		setCategories([]);
		setCategoryInput('');
		setTags([]);
		setTagInput('');
		setSelectedCircleIds(currentCircleId ? [currentCircleId] : []);
		setSupportingMedia(prev => {
			clearSupportingMedia(prev);
			return [];
		});
		// Reset Option 1 & 2 states
		setUserHint('');
		setDetectedItems([]);
		setSelectedItemName(null);
		setManualItemName('');
	}, [clearSupportingMedia, currentCircleId]);

	useEffect(() => {
		supportingMediaRef.current = supportingMedia;
	}, [supportingMedia]);

	useEffect(() => {
		return () => {
			if (savePhaseTimeoutRef.current) {
				clearTimeout(savePhaseTimeoutRef.current);
			}
			clearSupportingMedia(supportingMediaRef.current);
		};
	}, [clearSupportingMedia]);

	// Handle modal close - cleanup uploaded image if not saved
	const handleClose = async () => {
		if (state !== 'saving') {
			await cleanupTemporaryUploads();
		}
		resetState();
		onOpenChange(false);
	};

	const handleFile = async (file: File) => {
		if (!file) return;
		if (!isOnline) {
			toast({
				title: 'Connection required',
				description: 'You need an internet connection to upload listing photos.',
				variant: 'destructive',
			});
			return;
		}

		const typeError = getUploadValidationError(file, { maxSizeBytes: Number.MAX_SAFE_INTEGER });
		if (typeError) {
			toast({
				title: 'Unsupported image',
				description: typeError,
				variant: 'destructive',
			});
			return;
		}

		const preparedFile = await prepareImageForUpload(file);
		const validationError = getUploadValidationError(preparedFile);
		if (validationError) {
			toast({
				title: 'Image too large',
				description: validationError,
				variant: 'destructive',
			});
			return;
		}

		const reader = new FileReader();
		reader.onload = e => {
			setImagePreview(e.target?.result as string);
		};
		reader.readAsDataURL(preparedFile);
		await uploadAndProcess(preparedFile);
	};

	// File upload handler
	const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		await handleFile(file);
	};

	const handleDrop = async (files: File[]) => {
		const [file] = files;
		if (!file) return;
		await handleFile(file);
	};

	// Upload and process image - handles both Option 1 and Option 2 flows
	const uploadAndProcess = async (file: File) => {
		setState('uploading');

		try {
			// Upload image
			const uploadResult = await uploadImage(file).unwrap();
			setImagePath(uploadResult.path);
			setImageUrl(uploadResult.url);

			if (manualMode) {
				// Option 1 Flow: Upload → (Optional Hint) → Analyze
				setState('analyzing');
				try {
					const analysis = await analyzeImage({
						imageUrl: uploadResult.url,
						userHint: userHint.trim() || undefined,
					}).unwrap();
					setName(analysis.name);
					setDescription(analysis.description);
					setCategories(analysis.categories);
					setTags(analysis.tags);
					setState('editing');
				} catch (analysisError: unknown) {
					console.error('AI analysis failed:', analysisError);

					// Check if this is a validation error (item not found in image)
					const errorData = (
						analysisError as { data?: { code?: string; message?: string; suggestion?: string } }
					)?.data;
					if (errorData?.code === 'ITEM_NOT_FOUND') {
						toast({
							title: 'Item Not Found in Photo',
							description: errorData.message || 'The item you described was not found in the photo.',
							variant: 'destructive',
						});
						// Show the suggestion if available
						if (errorData.suggestion) {
							setTimeout(() => {
								toast({
									title: 'Suggestion',
									description: errorData.suggestion,
									variant: 'default',
								});
							}, 500);
						}
						// Go back to capture state so user can try again with different description
						await cleanupImage({ path: uploadResult.path, bucket: 'items' }).catch(cleanupError => {
							console.error('Failed to cleanup rejected image:', cleanupError);
						});
						setState('capture');
						setImagePreview(null);
						setImagePath(null);
						setImageUrl(null);
						// Keep the userHint so user can modify it
						return;
					}

					toast({
						title: 'AI Analysis Failed',
						description: 'Please fill in the details manually.',
						variant: 'default',
					});
					setState('editing');
				}
			} else {
				// Option 2 Flow: Upload → Detect → Select → Analyze
				setState('detecting');
				try {
					const detection = await detectItems(uploadResult.url).unwrap();
					if (detection.items && detection.items.length > 0) {
						setDetectedItems(detection.items);
						setState('selecting');
					} else {
						// No items detected, go to manual entry
						toast({
							title: 'No Items Detected',
							description: 'Please enter the item name manually.',
							variant: 'default',
						});
						setState('selecting');
					}
				} catch (detectionError) {
					console.error('Item detection failed:', detectionError);
					toast({
						title: 'Detection Failed',
						description: 'Please enter the item name manually.',
						variant: 'default',
					});
					setState('selecting');
				}
			}
		} catch (error) {
			console.error('Upload failed:', error);
			toast({
				title: 'Upload Failed',
				description: 'Failed to upload image. Please try again.',
				variant: 'destructive',
			});
			setState('capture');
			setImagePreview(null);
		}
	};

	// Handle item selection in Option 2 flow
	const handleItemSelect = async (itemName: string) => {
		if (!imageUrl) return;

		setSelectedItemName(itemName);
		setState('analyzing');

		try {
			const analysis = await analyzeImage({
				imageUrl,
				selectedItem: itemName,
			}).unwrap();
			setName(analysis.name);
			setDescription(analysis.description);
			setCategories(analysis.categories);
			setTags(analysis.tags);
			setState('editing');
		} catch (error: unknown) {
			console.error('AI analysis failed:', error);

			// Check if this is a validation error (item not found in image)
			const errorData = (error as { data?: { code?: string; message?: string; suggestion?: string } })?.data;
			if (errorData?.code === 'ITEM_NOT_FOUND') {
				toast({
					title: 'Item Not Found',
					description: errorData.message || 'The selected item was not found in the photo.',
					variant: 'destructive',
				});
				// Go back to selection state to let user pick a different item
				setState('selecting');
				setSelectedItemName(null);
				return;
			}

			toast({
				title: 'AI Analysis Failed',
				description: 'Please fill in the details manually.',
				variant: 'destructive',
			});
			setState('editing');
		}
	};

	// Handle manual entry in Option 2 flow
	const handleManualEntry = async () => {
		if (!imageUrl || !manualItemName.trim()) {
			toast({
				title: 'Item Name Required',
				description: 'Please enter an item name.',
				variant: 'destructive',
			});
			return;
		}

		await handleItemSelect(manualItemName.trim());
	};

	// Retry AI analysis (kept for potential future use)
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const retryAnalysis = async () => {
		if (!imageUrl) return;

		setState('analyzing');
		try {
			const analysis = await analyzeImage({
				imageUrl,
				selectedItem: selectedItemName || undefined,
				userHint: userHint.trim() || undefined,
			}).unwrap();
			setName(analysis.name);
			setDescription(analysis.description);
			setCategories(analysis.categories);
			setTags(analysis.tags);
			setState('editing');
		} catch (error) {
			console.error('AI analysis failed:', error);
			toast({
				title: 'AI Analysis Failed',
				description: 'Please fill in the details manually.',
				variant: 'destructive',
			});
			setState('editing');
		}
	};

	// Category management
	const addCategory = () => {
		const trimmed = categoryInput.trim();
		if (trimmed && !categories.includes(trimmed)) {
			setCategories([...categories, trimmed]);
			setCategoryInput('');
		}
	};

	const removeCategory = (category: string) => {
		setCategories(categories.filter(c => c !== category));
	};

	const handleCategoryKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			addCategory();
		}
	};

	// Tag management
	const addTag = () => {
		const trimmed = tagInput.trim();
		if (trimmed && !tags.includes(trimmed)) {
			setTags([...tags, trimmed]);
			setTagInput('');
		}
	};

	const removeTag = (tag: string) => {
		setTags(tags.filter(t => t !== tag));
	};

	const handleTagKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault();
			addTag();
		}
	};

	// Circle selection
	const toggleCircle = (circleId: string) => {
		setSelectedCircleIds(prev => {
			if (prev.includes(circleId)) {
				return prev.filter(id => id !== circleId);
			}
			return [...prev, circleId];
		});
	};

	const toggleSelectAllCircles = () => {
		if (selectedCircleIds.length === circles.length) {
			// Deselect all
			setSelectedCircleIds([]);
		} else {
			// Select all
			setSelectedCircleIds(circles.map(c => c.id));
		}
	};

	const allCirclesSelected = circles.length > 0 && selectedCircleIds.length === circles.length;

	// Handle supporting media upload
	const handleSupportingMediaUpload = async (files: FileList | null) => {
		if (!files || files.length === 0) return;
		if (!isOnline) {
			toast({
				title: 'Connection required',
				description: 'Supporting media uploads need an internet connection.',
				variant: 'destructive',
			});
			return;
		}

		const filesArray = Array.from(files);
		const totalFiles = supportingMedia.length + filesArray.length;

		if (totalFiles > MAX_MEDIA_ATTACHMENTS) {
			toast({
				title: 'Too Many Files',
				description: `You can upload a maximum of ${MAX_MEDIA_ATTACHMENTS} supporting media files.`,
				variant: 'destructive',
			});
			return;
		}

		for (const file of filesArray) {
			try {
				const typeError = getUploadValidationError(file, {
					allowVideo: true,
					maxSizeBytes: file.type.startsWith('image/') ? Number.MAX_SAFE_INTEGER : MAX_UPLOAD_SIZE_BYTES,
				});
				if (typeError) {
					toast({
						title: 'Unsupported media',
						description: typeError,
						variant: 'destructive',
					});
					continue;
				}

				const preparedFile = file.type.startsWith('image/') ? await prepareImageForUpload(file) : file;
				const validationError = getUploadValidationError(preparedFile, { allowVideo: true });
				if (validationError) {
					toast({
						title: 'File too large',
						description: validationError,
						variant: 'destructive',
					});
					continue;
				}

				const uploadResult = await uploadMedia(preparedFile).unwrap();
				const preview = URL.createObjectURL(preparedFile);

				setSupportingMedia(prev => [
					...prev,
					{
						path: uploadResult.path,
						url: uploadResult.url,
						preview,
						type: preparedFile.type,
					},
				]);
			} catch (error) {
				console.error('Failed to upload media:', error);
				toast({
					title: 'Upload Failed',
					description: `Failed to upload ${file.name}. Please try again.`,
					variant: 'destructive',
				});
			}
		}
	};

	// Remove supporting media
	const removeSupportingMedia = async (index: number) => {
		const media = supportingMedia[index];
		if (media) {
			try {
				await cleanupImage({ path: media.path, bucket: 'media' });
			} catch (error) {
				console.error('Failed to cleanup media:', error);
			}
			revokePreviewUrl(media.preview);
			setSupportingMedia(prev => prev.filter((_, i) => i !== index));
		}
	};

	// Save item
	const handleSave = async () => {
		if (!imagePath || !imageUrl || !name.trim() || selectedCircleIds.length === 0) {
			toast({
				title: 'Missing Information',
				description: 'Please provide a name and select at least one circle.',
				variant: 'destructive',
			});
			return;
		}

		if (savePhaseTimeoutRef.current) {
			clearTimeout(savePhaseTimeoutRef.current);
			savePhaseTimeoutRef.current = null;
		}
		setSavePhase('validating');
		savePhaseTimeoutRef.current = setTimeout(() => setSavePhase('saving'), 1500);

		try {
			await createItem({
				name: name.trim(),
				description: description.trim() || undefined,
				imagePath,
				imageUrl,
				mediaPaths: supportingMedia.map(m => m.path),
				categories,
				tags,
				circleIds: selectedCircleIds,
			}).unwrap();

			if (savePhaseTimeoutRef.current) {
				clearTimeout(savePhaseTimeoutRef.current);
				savePhaseTimeoutRef.current = null;
			}
			setSavePhase('idle');
			toast({
				title: 'Item Created!',
				description: `${name} has been shared with your circles.`,
			});

			onItemCreated?.();
			resetState();
			onOpenChange(false);
		} catch (error) {
			if (savePhaseTimeoutRef.current) {
				clearTimeout(savePhaseTimeoutRef.current);
				savePhaseTimeoutRef.current = null;
			}
			console.error('Failed to create item:', error);
			const errData =
				error && typeof error === 'object' && 'data' in error
					? (error.data as {
							code?: string;
							message?: string;
							details?: { imageLabel: string; reason: string; detectedItems?: string[] }[];
						})
					: null;
			if (errData?.code === 'ITEM_MISMATCH') {
				setSavePhase('validating');
				setTimeout(() => setSavePhase('idle'), 600);
				const detailLines = (errData.details ?? []).map(
					d =>
						`${d.imageLabel}: ${d.reason}${d.detectedItems?.length ? ` (Detected: ${d.detectedItems.slice(0, 5).join(', ')}${d.detectedItems.length > 5 ? '…' : ''})` : ''}`,
				);
				toast({
					title: errData.message ?? 'Listing does not match photo(s)',
					description: detailLines.length > 0 ? detailLines.join('\n') : undefined,
					variant: 'destructive',
				});
			} else {
				setSavePhase('idle');
				toast({
					title: 'Error',
					description: 'Failed to create item. Please try again.',
					variant: 'destructive',
				});
			}
		}
	};

	// Check if we're in a loading state
	const isLoading = state === 'uploading' || state === 'detecting' || state === 'analyzing' || state === 'saving';

	return (
		<Dialog open={open} onOpenChange={open ? handleClose : onOpenChange}>
			<DialogContent
				className="sm:max-w-lg h-[90dvh] max-h-[90dvh] flex flex-col p-0"
				onInteractOutside={e => e.preventDefault()}
			>
				<DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Sparkles className="h-5 w-5 text-primary" />
							<DialogTitle>Add New Item</DialogTitle>
							{/* Toggle Switch for Option 1/2 */}
							{state === 'capture' && (
								<div className="flex items-center gap-2 mt-1">
									<Label
										htmlFor="manual-mode"
										className="text-xs text-muted-foreground cursor-pointer"
									>
										Quick describe
									</Label>
									<Switch
										id="manual-mode"
										checked={manualMode}
										onCheckedChange={setManualMode}
										disabled={isLoading}
									/>
								</div>
							)}
						</div>
					</div>
					<DialogDescription>
						{state === 'capture' && 'Upload or capture an image to get started'}
						{state === 'uploading' && 'Uploading your image...'}
						{state === 'detecting' && 'Detecting items in your image...'}
						{state === 'selecting' && 'Select the item you want to share'}
						{state === 'analyzing' && 'AI is analyzing your item...'}
						{state === 'editing' && 'Review and edit the details'}
						{state === 'saving' && 'Creating your item...'}
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					{/* Scrollable content wrapper */}

					{/* Capture State */}
					{state === 'capture' && (
						<div className="space-y-4">
							{!isOnline && (
								<div className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/60 dark:text-amber-100">
									You&apos;re offline. Reconnect before uploading listing photos or supporting media.
								</div>
							)}
							{/* Option 1: Optional Text Input (when manualMode is ON) */}
							{manualMode && (
								<div className="space-y-2">
									<Label
										htmlFor="item-hint"
										className="text-xs uppercase tracking-wide text-muted-foreground"
									>
										What is this item? <span className="text-muted-foreground/70">(optional)</span>
									</Label>
									<Input
										id="item-hint"
										placeholder="e.g., Blue summer dress"
										value={userHint}
										onChange={e => setUserHint(e.target.value)}
										className="h-11"
									/>
									<p className="text-xs text-muted-foreground">
										Help AI identify the correct item by describing it briefly.
									</p>
								</div>
							)}

							{/* File Inputs */}
							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								onChange={handleFileSelect}
								className="hidden"
							/>
							<input
								ref={cameraInputRef}
								type="file"
								accept="image/*"
								capture="environment"
								onChange={handleFileSelect}
								className="hidden"
							/>

							{/* Desktop: Drag + Drop */}
							{isDesktop ? (
								<Dropzone
									accept={{
										'image/jpeg': [],
										'image/png': [],
										'image/gif': [],
										'image/webp': [],
									}}
									maxFiles={1}
									onDrop={handleDrop}
									disabled={isLoading}
								>
									<div className="flex flex-col items-center gap-3">
										<div className="p-4 rounded-full bg-primary/10">
											<Upload className="h-8 w-8 text-primary" />
										</div>
										<div>
											<p className="font-medium text-foreground">Upload an image</p>
											<p className="text-sm text-muted-foreground mt-1">Click or drag and drop</p>
										</div>
										<p className="text-xs text-muted-foreground">JPEG, PNG, GIF, WebP up to 5MB</p>
									</div>
								</Dropzone>
							) : (
								<div className="space-y-3">
									<Button
										variant="outline"
										className="w-full gap-2 h-12"
										onClick={() => fileInputRef.current?.click()}
										disabled={isLoading}
									>
										<Upload className="h-5 w-5" />
										Upload from device
									</Button>
									<Button
										variant="outline"
										className="w-full gap-2 h-12"
										onClick={() => cameraInputRef.current?.click()}
										disabled={isLoading}
									>
										<Camera className="h-5 w-5" />
										Take a photo
									</Button>
									<p className="text-xs text-muted-foreground text-center">
										Choose a photo from your library or open the camera directly.
									</p>
								</div>
							)}
						</div>
					)}

					{/* Loading States */}
					{(state === 'uploading' || state === 'detecting' || state === 'analyzing') && (
						<div className="py-12 flex flex-col items-center gap-4">
							{imagePreview && (
								<div className="w-32 h-32 rounded-lg overflow-hidden border border-border">
									<img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
								</div>
							)}
							<div className="flex flex-col items-center gap-2">
								<Loader2 className="h-8 w-8 animate-spin text-primary" />
								<p className="text-sm text-muted-foreground">
									{state === 'uploading' && 'Uploading image...'}
									{state === 'detecting' && 'Detecting items in image...'}
									{state === 'analyzing' && 'Analyzing with AI...'}
								</p>
							</div>
						</div>
					)}

					{/* Option 2: Item Selection State */}
					{state === 'selecting' && (
						<div className="space-y-4">
							{/* Image Preview */}
							{imagePreview && (
								<div className="w-full rounded-lg overflow-hidden border border-border">
									<img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
								</div>
							)}

							{/* Detected Items Grid */}
							{detectedItems.length > 0 && (
								<div className="space-y-3">
									<Label className="text-sm font-medium">We found these items:</Label>
									<div className="grid grid-cols-2 gap-3">
										{detectedItems.map((item, index) => (
											<button
												key={index}
												type="button"
												onClick={() => handleItemSelect(item.name)}
												disabled={isAnalyzing}
												className="p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
											>
												<div className="font-medium text-sm mb-1">{item.name}</div>
												{item.description && (
													<div className="text-xs text-muted-foreground line-clamp-2">
														{item.description}
													</div>
												)}
												{item.category && (
													<Badge variant="secondary" className="mt-2 text-xs">
														{item.category}
													</Badge>
												)}
											</button>
										))}
									</div>
								</div>
							)}

							{/* Manual Entry Option */}
							<div className="relative">
								<div className="absolute inset-0 flex items-center">
									<span className="w-full border-t" />
								</div>
								<div className="relative flex justify-center text-xs uppercase">
									<span className="bg-background px-2 text-muted-foreground">or enter manually</span>
								</div>
							</div>

							<div className="space-y-2">
								<Input
									placeholder="Enter item name..."
									value={manualItemName}
									onChange={e => setManualItemName(e.target.value)}
									onKeyDown={e => {
										if (e.key === 'Enter' && manualItemName.trim()) {
											handleManualEntry();
										}
									}}
									className="h-11"
								/>
								<Button
									onClick={handleManualEntry}
									disabled={!manualItemName.trim() || isAnalyzing}
									className="w-full"
								>
									{isAnalyzing ? (
										<>
											<Loader2 className="h-4 w-4 animate-spin mr-2" />
											Analyzing...
										</>
									) : (
										'Continue'
									)}
								</Button>
							</div>
						</div>
					)}

					{/* Edit State */}
					{state === 'editing' && (
						<div className="space-y-5">
							{/* Image Preview and Supporting Media */}
							<div className="flex flex-col gap-2">
								<div className="app-scrollbar app-scrollbar-thin -mx-6 overflow-x-auto px-6">
									<div className="flex gap-2 items-start min-w-max">
										{/* Main Image */}
										<div className="w-24 h-24 rounded-lg overflow-hidden border border-border flex-shrink-0">
											{imagePreview ? (
												<img
													src={imagePreview}
													alt="Preview"
													className="w-full h-full object-cover"
												/>
											) : (
												<div className="w-full h-full bg-muted flex items-center justify-center">
													<ImageIcon className="h-8 w-8 text-muted-foreground" />
												</div>
											)}
										</div>

										{/* Supporting Media Items */}
										{supportingMedia.map((media, index) => (
											<div
												key={index}
												className="relative w-24 h-24 rounded-lg overflow-hidden border border-border flex-shrink-0"
											>
												{media.type.startsWith('video/') ? (
													<video
														src={media.preview}
														className="w-full h-full object-cover"
														muted
														playsInline
													/>
												) : (
													<img
														src={media.preview}
														alt={`Media ${index + 1}`}
														className="w-full h-full object-cover"
													/>
												)}
												<button
													type="button"
													onClick={() => removeSupportingMedia(index)}
													className="absolute top-1 right-1 p-1 bg-background/80 rounded-full hover:bg-background transition-colors"
												>
													<X className="w-3 h-3" />
												</button>
											</div>
										))}

										{/* Plus Icon Input */}
										{supportingMedia.length < 5 && (
											<div className="flex flex-col items-center gap-1 flex-shrink-0">
												<input
													ref={supportingMediaInputRef}
													type="file"
													accept="image/*,video/*"
													multiple
													onChange={e => handleSupportingMediaUpload(e.target.files)}
													className="hidden"
												/>
												<button
													type="button"
													onClick={() => supportingMediaInputRef.current?.click()}
													className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center hover:border-primary/50 hover:bg-muted/50 transition-all cursor-pointer"
												>
													<Plus className="w-6 h-6 text-muted-foreground" />
												</button>
												<span className="text-xs text-muted-foreground text-center whitespace-nowrap">
													(5 max, 5MB each)
												</span>
											</div>
										)}
									</div>
								</div>
							</div>

							{/* Name */}
							<div className="space-y-2">
								<Label
									htmlFor="item-name"
									className="text-xs uppercase tracking-wide text-muted-foreground"
								>
									Name *
								</Label>
								<Input
									id="item-name"
									placeholder="e.g., Camping Tent"
									value={name}
									onChange={e => setName(e.target.value)}
									className="h-11"
								/>
							</div>

							{/* Description */}
							<div className="space-y-2">
								<Label
									htmlFor="item-description"
									className="text-xs uppercase tracking-wide text-muted-foreground"
								>
									Description
								</Label>
								<Textarea
									id="item-description"
									placeholder="Describe your item, its condition, and any important details..."
									value={description}
									onChange={e => setDescription(e.target.value)}
									rows={3}
									className="resize-none"
								/>
							</div>

							{/* Categories */}
							<div className="space-y-2">
								<Label className="text-xs uppercase tracking-wide text-muted-foreground">
									Categories
								</Label>
								<div className="flex flex-wrap gap-2 mb-2">
									{categories.map(category => (
										<Badge key={category} variant="secondary" className="gap-1">
											{category}
											<button
												onClick={() => removeCategory(category)}
												className="ml-1 hover:text-destructive"
											>
												<X className="h-3 w-3" />
											</button>
										</Badge>
									))}
								</div>
								<div className="flex gap-2">
									<Input
										placeholder="Add a category..."
										value={categoryInput}
										onChange={e => setCategoryInput(e.target.value)}
										onKeyDown={handleCategoryKeyDown}
										className="flex-1"
									/>
									<Button variant="outline" onClick={addCategory} disabled={!categoryInput.trim()}>
										Add
									</Button>
								</div>
							</div>

							{/* Tags */}
							<div className="space-y-2">
								<Label className="text-xs uppercase tracking-wide text-muted-foreground">Tags</Label>
								<div className="flex flex-wrap gap-2 mb-2">
									{tags.map(tag => (
										<Badge key={tag} variant="outline" className="gap-1">
											{tag}
											<button
												onClick={() => removeTag(tag)}
												className="ml-1 hover:text-destructive"
											>
												<X className="h-3 w-3" />
											</button>
										</Badge>
									))}
								</div>
								<div className="flex gap-2">
									<Input
										placeholder="Add a tag..."
										value={tagInput}
										onChange={e => setTagInput(e.target.value)}
										onKeyDown={handleTagKeyDown}
										className="flex-1"
									/>
									<Button variant="outline" onClick={addTag} disabled={!tagInput.trim()}>
										Add
									</Button>
								</div>
							</div>

							{/* Circle Selection */}
							<div className="space-y-3">
								<Label className="text-xs uppercase tracking-wide text-muted-foreground">
									Share with Circles *
								</Label>

								{isLoadingCircles ? (
									<div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
										<Loader2 className="h-4 w-4 animate-spin" />
										Loading circles...
									</div>
								) : circles.length === 0 ? (
									<div className="text-sm text-muted-foreground py-4 text-center">
										You need to join or create a circle first.
									</div>
								) : (
									<>
										{/* Select All Checkbox */}
										{circles.length > 1 && (
											<button
												type="button"
												onClick={toggleSelectAllCircles}
												className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-all text-left w-full"
											>
												<div
													className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
														allCirclesSelected
															? 'border-primary bg-primary'
															: 'border-muted-foreground'
													}`}
												>
													{allCirclesSelected && <Check className="h-3 w-3 text-white" />}
												</div>
												<span className="font-medium text-sm">Select All Circles</span>
											</button>
										)}

										{/* Horizontal Scrollable Circle List */}
										<div className="app-scrollbar app-scrollbar-thin flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
											{circles.map(circle => (
												<button
													key={circle.id}
													type="button"
													onClick={() => toggleCircle(circle.id)}
													className={`flex items-center gap-3 p-3 rounded-lg border transition-all text-left flex-shrink-0 snap-start min-w-[200px] ${
														selectedCircleIds.includes(circle.id)
															? 'border-primary bg-primary/5'
															: 'border-border hover:border-primary/50 hover:bg-muted/50'
													}`}
												>
													<div
														className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
															selectedCircleIds.includes(circle.id)
																? 'border-primary bg-primary'
																: 'border-muted-foreground'
														}`}
													>
														{selectedCircleIds.includes(circle.id) && (
															<Check className="h-3 w-3 text-white" />
														)}
													</div>
													<span className="font-medium flex-1 truncate">{circle.name}</span>
												</button>
											))}
										</div>
									</>
								)}
							</div>
						</div>
					)}

					{/* Saving State */}
					{state === 'saving' && (
						<div className="py-12 flex flex-col items-center gap-4">
							<Loader2 className="h-8 w-8 animate-spin text-primary" />
							<p className="text-sm text-muted-foreground">Creating your item...</p>
						</div>
					)}
				</div>
				{/* End of scrollable content wrapper */}

				{/* Footer with Action Buttons - Always visible when in editing state */}
				{state === 'editing' && (
					<div className="flex-shrink-0 px-6 py-4 border-t bg-background">
						<div className="flex gap-3">
							<Button
								variant="outline"
								onClick={async () => {
									await cleanupTemporaryUploads();
									resetState();
								}}
								className="flex-1"
								disabled={isSaving || savePhase !== 'idle'}
							>
								Re-upload
							</Button>
							<Button
								onClick={handleSave}
								className="flex-1 gap-2"
								disabled={
									!name.trim() || selectedCircleIds.length === 0 || isSaving || savePhase !== 'idle'
								}
							>
								{isSaving || savePhase !== 'idle' ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										{savePhase === 'validating'
											? 'Validating...'
											: savePhase === 'saving'
												? 'Saving...'
												: 'Creating...'}
									</>
								) : (
									<>
										<Sparkles className="h-4 w-4" />
										Create Item
									</>
								)}
							</Button>
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
