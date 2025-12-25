'use client';

import type React from 'react';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Sparkles, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CreateListingModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (listing: { title: string; description: string; circle: string; image?: string; tags: string[] }) => void;
	availableCircles: { id: string; name: string }[];
}

export function CreateListingModal({ open, onOpenChange, onSubmit, availableCircles }: CreateListingModalProps) {
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [circle, setCircle] = useState(availableCircles[0]?.id || '');
	const [tags, setTags] = useState('');
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const [isGenerating, setIsGenerating] = useState(false);
	const [error, setError] = useState('');

	const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = event => {
				setImagePreview(event.target?.result as string);
			};
			reader.readAsDataURL(file);
		}
	};

	const generateDescription = async () => {
		if (!title.trim()) {
			setError('Please enter an item title first');
			return;
		}

		setIsGenerating(true);
		setError('');

		try {
			// Simulate AI description generation using the AI SDK
			const response = await fetch('/api/generate-description', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ itemTitle: title }),
			});

			if (!response.ok) {
				throw new Error('Failed to generate description');
			}

			const data = await response.json();
			setDescription(data.description);
		} catch (err) {
			setError('Failed to generate description. Please write one manually.');
		} finally {
			setIsGenerating(false);
		}
	};

	const handleSubmit = () => {
		if (!title.trim() || !description.trim() || !circle) {
			setError('Please fill in all required fields');
			return;
		}

		onSubmit({
			title,
			description,
			circle,
			tags: tags
				.split(',')
				.map(t => t.trim())
				.filter(Boolean),
			image: imagePreview || undefined,
		});

		// Reset form
		setTitle('');
		setDescription('');
		setTags('');
		setImagePreview(null);
		setError('');
		onOpenChange(false);
	};

	const handleClose = () => {
		setTitle('');
		setDescription('');
		setTags('');
		setImagePreview(null);
		setError('');
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Create New Listing</DialogTitle>
					<DialogDescription>Share an item with your circles</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{/* Item Title */}
					<div className="space-y-2">
						<Label
							htmlFor="listing-title"
							className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground"
						>
							Item Title *
						</Label>
						<Input
							id="listing-title"
							placeholder="e.g., Camping Tent, Power Drill, Ladder"
							value={title}
							onChange={e => setTitle(e.target.value)}
							className="transition-colors"
						/>
					</div>

					{/* Circle Selection */}
					<div className="space-y-2">
						<Label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
							Share with Circle *
						</Label>
						<Select value={circle} onValueChange={setCircle}>
							<SelectTrigger className="w-full justify-between">
								<SelectValue placeholder="Choose a circle" />
							</SelectTrigger>
							<SelectContent>
								{availableCircles.map(c => (
									<SelectItem key={c.id} value={c.id}>
										{c.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Image Upload */}
					<div className="space-y-2">
						<Label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
							Upload Images
						</Label>
						{imagePreview ? (
							<div className="relative">
								<img
									src={imagePreview || '/placeholder.svg'}
									alt="Preview"
									className="w-full h-40 rounded-lg object-cover border border-border"
								/>
								<button
									onClick={() => setImagePreview(null)}
									className="absolute top-2 right-2 p-1 bg-background/80 rounded-full hover:bg-background transition-colors"
								>
									<X className="w-4 h-4" />
								</button>
							</div>
						) : (
							<label className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-all duration-200 block">
								<Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
								<p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
								<input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
							</label>
						)}
					</div>

					{/* Description with AI Generation */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label className="text-xs uppercase tracking-wide text-muted-foreground">
								Description *
							</Label>
							<Button
								size="sm"
								variant="outline"
								onClick={generateDescription}
								disabled={isGenerating || !title.trim()}
								className="gap-1 bg-transparent"
							>
								<Sparkles className="w-3 h-3" />
								{isGenerating ? 'Generating...' : 'Generate with AI'}
							</Button>
						</div>
						<Textarea
							placeholder="Describe your item, its condition, features, etc."
							value={description}
							onChange={e => setDescription(e.target.value)}
							rows={4}
							className="resize-none transition-colors"
						/>
					</div>

					{/* Tags */}
					<div className="space-y-2">
						<Label
							htmlFor="listing-tags"
							className="flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground"
						>
							Tags (comma separated)
						</Label>
						<Input
							id="listing-tags"
							placeholder="e.g., Camping, Outdoor, Equipment"
							value={tags}
							onChange={e => setTags(e.target.value)}
							className="transition-colors"
						/>
					</div>

					{/* Action Buttons */}
					<div className="flex gap-2 pt-4">
						<Button
							variant="outline"
							onClick={handleClose}
							className="flex-1 transition-all duration-200 bg-transparent"
						>
							Cancel
						</Button>
						<Button onClick={handleSubmit} className="flex-1 transition-all duration-200">
							Create Listing
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
