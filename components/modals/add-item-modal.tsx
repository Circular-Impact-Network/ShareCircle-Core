'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface AddItemModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function AddItemModal({ open, onOpenChange }: AddItemModalProps) {
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [tags, setTags] = useState('');

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Add Item</DialogTitle>
					<DialogDescription>Share an item with your circle</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div>
						<Label
							htmlFor="item-name"
							className="mb-2 flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground"
						>
							Item Name
						</Label>
						<Input
							id="item-name"
							placeholder="e.g., Camping Tent"
							value={title}
							onChange={e => setTitle(e.target.value)}
							className="transition-colors"
						/>
					</div>

					<div>
						<Label
							htmlFor="item-description"
							className="mb-2 flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground"
						>
							Description
						</Label>
						<Textarea
							id="item-description"
							placeholder="Describe your item..."
							value={description}
							onChange={e => setDescription(e.target.value)}
							rows={3}
							className="resize-none transition-colors"
						/>
					</div>

					<div>
						<Label className="mb-2 flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground">
							Upload Images
						</Label>
						<div className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-all duration-200">
							<Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
							<p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
						</div>
					</div>

					<div>
						<Label
							htmlFor="item-tags"
							className="mb-2 flex flex-col gap-1 text-xs uppercase tracking-wide text-muted-foreground"
						>
							Tags (comma separated)
						</Label>
						<Input
							id="item-tags"
							placeholder="e.g., Camping, Outdoor, Equipment"
							value={tags}
							onChange={e => setTags(e.target.value)}
							className="transition-colors"
						/>
					</div>

					<div className="flex gap-2 pt-4">
						<Button
							variant="outline"
							onClick={() => onOpenChange(false)}
							className="flex-1 transition-all duration-200"
						>
							Cancel
						</Button>
						<Button onClick={() => onOpenChange(false)} className="flex-1 transition-all duration-200">
							Post Item
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
