'use client';

import { useState, useEffect } from 'react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface EditCircleModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	circle: {
		id: string;
		name: string;
		description: string | null;
	} | null;
	onCircleUpdated?: (circle: { id: string; name: string; description: string | null }) => void;
}

export function EditCircleModal({ open, onOpenChange, circle, onCircleUpdated }: EditCircleModalProps) {
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState('');

	// Initialize form with circle data when modal opens
	useEffect(() => {
		if (circle && open) {
			setName(circle.name);
			setDescription(circle.description || '');
			setError('');
		}
	}, [circle, open]);

	const handleSave = async () => {
		if (!circle) return;

		if (!name.trim()) {
			setError('Please enter a circle name');
			return;
		}

		if (name.trim().length > 100) {
			setError('Circle name must be less than 100 characters');
			return;
		}

		setIsLoading(true);
		setError('');

		try {
			const response = await fetch(`/api/circles/${circle.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					description: description.trim() || null,
				}),
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || 'Failed to update circle');
			}

			const updatedCircle = await response.json();

			if (onCircleUpdated) {
				onCircleUpdated({
					id: updatedCircle.id,
					name: updatedCircle.name,
					description: updatedCircle.description,
				});
			}

			onOpenChange(false);
		} catch (err) {
			console.error('Error updating circle:', err);
			setError(err instanceof Error ? err.message : 'Failed to update circle. Please try again.');
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => {
		setError('');
		onOpenChange(false);
	};

	const hasChanges = circle && (name !== circle.name || description !== (circle.description || ''));

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Edit Circle</DialogTitle>
					<DialogDescription>Update your circle&apos;s name and description</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label htmlFor="edit-name">
							Circle Name <span className="text-destructive">*</span>
						</Label>
						<Input
							id="edit-name"
							placeholder="e.g., Beach House Friends"
							value={name}
							onChange={e => {
								setName(e.target.value);
								setError('');
							}}
							disabled={isLoading}
							maxLength={100}
						/>
						<p className="text-xs text-muted-foreground">{name.length}/100 characters</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="edit-description">Description</Label>
						<Textarea
							id="edit-description"
							placeholder="What's this circle about?"
							value={description}
							onChange={e => setDescription(e.target.value)}
							rows={3}
							className="resize-none"
							disabled={isLoading}
						/>
					</div>

					{error && (
						<Alert variant="destructive">
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}
				</div>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="outline" onClick={handleClose} disabled={isLoading}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={isLoading || !name.trim() || !hasChanges}>
						{isLoading ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Saving...
							</>
						) : (
							'Save Changes'
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
