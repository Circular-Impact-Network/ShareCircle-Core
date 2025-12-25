'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
	Upload,
	Camera,
	Loader2,
	Sparkles,
	X,
	Check,
	ImageIcon,
	RefreshCw,
	AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
	useUploadItemImageMutation,
	useAnalyzeImageMutation,
	useCreateItemMutation,
	useCleanupImageMutation,
} from '@/lib/redux/api/itemsApi';

type ModalState = 'capture' | 'uploading' | 'analyzing' | 'editing' | 'saving';

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
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	// State
	const [state, setState] = useState<ModalState>('capture');
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const [imagePath, setImagePath] = useState<string | null>(null);
	const [imageUrl, setImageUrl] = useState<string | null>(null);
	const [showCamera, setShowCamera] = useState(false);
	const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
	const [cameraError, setCameraError] = useState<string | null>(null);

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

	// RTK Query mutations
	const [uploadImage] = useUploadItemImageMutation();
	const [analyzeImage, { isLoading: isAnalyzing }] = useAnalyzeImageMutation();
	const [createItem, { isLoading: isSaving }] = useCreateItemMutation();
	const [cleanupImage] = useCleanupImageMutation();

	// Fetch circles when modal opens
	useEffect(() => {
		if (open) {
			fetchCircles();
		}
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
		setShowCamera(false);
		setName('');
		setDescription('');
		setCategories([]);
		setCategoryInput('');
		setTags([]);
		setTagInput('');
		setSelectedCircleIds(currentCircleId ? [currentCircleId] : []);
		setCameraError(null);

		// Stop camera if running
		if (cameraStream) {
			cameraStream.getTracks().forEach(track => track.stop());
			setCameraStream(null);
		}
	}, [cameraStream, currentCircleId]);

	// Handle modal close - cleanup uploaded image if not saved
	const handleClose = async () => {
		if (imagePath && state !== 'saving') {
			try {
				await cleanupImage(imagePath);
			} catch (error) {
				console.error('Failed to cleanup image:', error);
			}
		}
		resetState();
		onOpenChange(false);
	};

	// File upload handler
	const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Create preview
		const reader = new FileReader();
		reader.onload = e => {
			setImagePreview(e.target?.result as string);
		};
		reader.readAsDataURL(file);

		// Upload file
		await uploadAndAnalyze(file);
	};

	// Camera handlers
	const startCamera = async () => {
		try {
			setCameraError(null);
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
			});
			setCameraStream(stream);
			if (videoRef.current) {
				videoRef.current.srcObject = stream;
			}
			setShowCamera(true);
		} catch (error) {
			console.error('Camera error:', error);
			setCameraError('Could not access camera. Please check permissions.');
		}
	};

	const capturePhoto = () => {
		if (!videoRef.current || !canvasRef.current) return;

		const video = videoRef.current;
		const canvas = canvasRef.current;
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		ctx.drawImage(video, 0, 0);

		// Stop camera
		if (cameraStream) {
			cameraStream.getTracks().forEach(track => track.stop());
			setCameraStream(null);
		}
		setShowCamera(false);

		// Get image data
		canvas.toBlob(
			async blob => {
				if (!blob) return;

				// Create preview
				setImagePreview(canvas.toDataURL('image/jpeg', 0.9));

				// Create file from blob
				const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });

				// Upload and analyze
				await uploadAndAnalyze(file);
			},
			'image/jpeg',
			0.9,
		);
	};

	const cancelCamera = () => {
		if (cameraStream) {
			cameraStream.getTracks().forEach(track => track.stop());
			setCameraStream(null);
		}
		setShowCamera(false);
	};

	// Upload and analyze image
	const uploadAndAnalyze = async (file: File) => {
		setState('uploading');

		try {
			// Upload image
			const uploadResult = await uploadImage(file).unwrap();
			setImagePath(uploadResult.path);
			setImageUrl(uploadResult.url);

			// Analyze image
			setState('analyzing');
			try {
				const analysis = await analyzeImage(uploadResult.url).unwrap();
				setName(analysis.name);
				setDescription(analysis.description);
				setCategories(analysis.categories);
				setTags(analysis.tags);
			} catch (analysisError) {
				console.error('AI analysis failed:', analysisError);
				toast({
					title: 'AI Analysis Failed',
					description: 'Please fill in the details manually.',
					variant: 'default',
				});
			}

			setState('editing');
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

	// Retry AI analysis
	const retryAnalysis = async () => {
		if (!imageUrl) return;

		setState('analyzing');
		try {
			const analysis = await analyzeImage(imageUrl).unwrap();
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

		setState('saving');

		try {
			await createItem({
				name: name.trim(),
				description: description.trim() || undefined,
				imagePath,
				imageUrl,
				categories,
				tags,
				circleIds: selectedCircleIds,
			}).unwrap();

			toast({
				title: 'Item Created!',
				description: `${name} has been shared with your circles.`,
			});

			onItemCreated?.();
			resetState();
			onOpenChange(false);
		} catch (error) {
			console.error('Failed to create item:', error);
			toast({
				title: 'Error',
				description: 'Failed to create item. Please try again.',
				variant: 'destructive',
			});
			setState('editing');
		}
	};

	// Check if we're in a loading state
	const isLoading = state === 'uploading' || state === 'analyzing' || state === 'saving';

	return (
		<Dialog open={open} onOpenChange={open ? handleClose : onOpenChange}>
			<DialogContent className="sm:max-w-lg h-[90vh] max-h-[90vh] flex flex-col p-0">
				<DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b">
					<DialogTitle className="flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-primary" />
						Add New Item
					</DialogTitle>
					<DialogDescription>
						{state === 'capture' && 'Upload or capture an image to get started'}
						{state === 'uploading' && 'Uploading your image...'}
						{state === 'analyzing' && 'AI is analyzing your item...'}
						{state === 'editing' && 'Review and edit the details'}
						{state === 'saving' && 'Creating your item...'}
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto px-6 py-4">{/* Scrollable content wrapper */}

				{/* Capture State */}
				{state === 'capture' && !showCamera && (
					<div className="space-y-4">
						{/* File Upload */}
						<input
							ref={fileInputRef}
							type="file"
							accept="image/jpeg,image/png,image/gif,image/webp"
							onChange={handleFileSelect}
							className="hidden"
						/>

						<div
							onClick={() => fileInputRef.current?.click()}
							className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-all duration-200 group"
						>
							<div className="flex flex-col items-center gap-3">
								<div className="p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
									<Upload className="h-8 w-8 text-primary" />
								</div>
								<div>
									<p className="font-medium text-foreground">Upload an image</p>
									<p className="text-sm text-muted-foreground mt-1">Click or drag and drop</p>
								</div>
								<p className="text-xs text-muted-foreground">JPEG, PNG, GIF, WebP up to 5MB</p>
							</div>
						</div>

						<div className="relative">
							<div className="absolute inset-0 flex items-center">
								<span className="w-full border-t" />
							</div>
							<div className="relative flex justify-center text-xs uppercase">
								<span className="bg-background px-2 text-muted-foreground">or</span>
							</div>
						</div>

						{/* Camera Button */}
						<Button variant="outline" className="w-full gap-2 h-12" onClick={startCamera}>
							<Camera className="h-5 w-5" />
							Take a Photo
						</Button>

						{cameraError && (
							<div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
								<AlertCircle className="h-4 w-4 flex-shrink-0" />
								{cameraError}
							</div>
						)}
					</div>
				)}

				{/* Camera View */}
				{showCamera && (
					<div className="space-y-4">
						<div className="relative rounded-lg overflow-hidden bg-black aspect-video">
							<video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
						</div>
						<div className="flex gap-2">
							<Button variant="outline" onClick={cancelCamera} className="flex-1">
								Cancel
							</Button>
							<Button onClick={capturePhoto} className="flex-1 gap-2">
								<Camera className="h-4 w-4" />
								Capture
							</Button>
						</div>
						<canvas ref={canvasRef} className="hidden" />
					</div>
				)}

				{/* Loading States */}
				{(state === 'uploading' || state === 'analyzing') && (
					<div className="py-12 flex flex-col items-center gap-4">
						{imagePreview && (
							<div className="w-32 h-32 rounded-lg overflow-hidden border border-border">
								<img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
							</div>
						)}
						<div className="flex flex-col items-center gap-2">
							<Loader2 className="h-8 w-8 animate-spin text-primary" />
							<p className="text-sm text-muted-foreground">
								{state === 'uploading' ? 'Uploading image...' : 'Analyzing with AI...'}
							</p>
						</div>
					</div>
				)}

				{/* Edit State */}
				{state === 'editing' && (
					<div className="space-y-5">
						{/* Image Preview */}
						<div className="flex gap-4">
							<div className="w-24 h-24 rounded-lg overflow-hidden border border-border flex-shrink-0">
								{imagePreview ? (
									<img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
								) : (
									<div className="w-full h-full bg-muted flex items-center justify-center">
										<ImageIcon className="h-8 w-8 text-muted-foreground" />
									</div>
								)}
							</div>
							<div className="flex-1 flex flex-col justify-center gap-2">
								<Button variant="outline" size="sm" onClick={retryAnalysis} disabled={isAnalyzing} className="gap-2">
									{isAnalyzing ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<RefreshCw className="h-4 w-4" />
									)}
									Re-analyze with AI
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										if (imagePath) cleanupImage(imagePath);
										resetState();
									}}
									className="text-muted-foreground hover:text-destructive"
								>
									Choose different image
								</Button>
							</div>
						</div>

						{/* Name */}
						<div className="space-y-2">
							<Label htmlFor="item-name" className="text-xs uppercase tracking-wide text-muted-foreground">
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
							<Label htmlFor="item-description" className="text-xs uppercase tracking-wide text-muted-foreground">
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
							<Label className="text-xs uppercase tracking-wide text-muted-foreground">Categories</Label>
							<div className="flex flex-wrap gap-2 mb-2">
								{categories.map(category => (
									<Badge key={category} variant="secondary" className="gap-1">
										{category}
										<button onClick={() => removeCategory(category)} className="ml-1 hover:text-destructive">
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
										<button onClick={() => removeTag(tag)} className="ml-1 hover:text-destructive">
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
							<Label className="text-xs uppercase tracking-wide text-muted-foreground">Share with Circles *</Label>

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
									<div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin">
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
													{selectedCircleIds.includes(circle.id) && <Check className="h-3 w-3 text-white" />}
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
				</div>{/* End of scrollable content wrapper */}

				{/* Footer with Action Buttons - Always visible when in editing state */}
				{state === 'editing' && (
					<div className="flex-shrink-0 px-6 py-4 border-t bg-background">
						<div className="flex gap-3">
							<Button variant="outline" onClick={handleClose} className="flex-1" disabled={isSaving}>
								Cancel
							</Button>
							<Button
								onClick={handleSave}
								className="flex-1 gap-2"
								disabled={!name.trim() || selectedCircleIds.length === 0 || isSaving}
							>
								{isSaving ? (
									<>
										<Loader2 className="h-4 w-4 animate-spin" />
										Creating...
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
