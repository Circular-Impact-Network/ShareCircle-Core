// Composer with image attachments (upload to attachments bucket) and send
import { ImagePlus, Smile, Send, X } from 'lucide-react';
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type MessageComposerProps = {
	value: string;
	onChange: (value: string) => void;
	onSend: (payload?: { attachments: { type: 'IMAGE'; path: string; url: string }[] }) => void;
	onTyping?: () => void;
	disabled?: boolean;
};

const DEFAULT_EMOJI = ['😀', '😂', '😍', '😎', '👍', '🙏', '🔥', '🎉', '❤️', '🥳'];

export function MessageComposer({ value, onChange, onSend, onTyping, disabled }: MessageComposerProps) {
	const emojis = useMemo(() => DEFAULT_EMOJI, []);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [attachments, setAttachments] = useState<{ id: string; file: File; previewUrl: string }[]>([]);
	const [isUploading, setIsUploading] = useState(false);

	useEffect(() => {
		return () => {
			for (const attachment of attachments) {
				URL.revokeObjectURL(attachment.previewUrl);
			}
		};
	}, [attachments]);

	const removeAttachment = (id: string) => {
		setAttachments(prev => {
			const target = prev.find(attachment => attachment.id === id);
			if (target) {
				URL.revokeObjectURL(target.previewUrl);
			}
			return prev.filter(attachment => attachment.id !== id);
		});
	};

	const handlePickAttachment = (event: ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(event.target.files || []);
		if (files.length === 0 || disabled) return;
		if (attachments.length + files.length > 5) {
			event.target.value = '';
			return;
		}
		setAttachments(prev => [
			...prev,
			...files.map(file => ({
				id: crypto.randomUUID(),
				file,
				previewUrl: URL.createObjectURL(file),
			})),
		]);
		event.target.value = '';
	};

	const handleSendClick = async () => {
		const hasBody = value.trim().length > 0;
		if (!hasBody && attachments.length === 0) return;

		setIsUploading(true);
		try {
			const uploadedAttachments = await Promise.all(
				attachments.map(async attachment => {
					const formData = new FormData();
					formData.append('file', attachment.file);
					const response = await fetch('/api/upload/image?bucket=attachments', {
						method: 'POST',
						body: formData,
					});
					if (!response.ok) {
						throw new Error('Failed to upload attachment');
					}
					const data = await response.json();
					return { type: 'IMAGE' as const, path: data.path as string, url: data.url as string };
				}),
			);

			onSend({ attachments: uploadedAttachments });
			setAttachments(prev => {
				for (const attachment of prev) {
					URL.revokeObjectURL(attachment.previewUrl);
				}
				return [];
			});
		} catch (error) {
			console.error('Attachment upload failed:', error);
		} finally {
			setIsUploading(false);
		}
	};

	return (
		<div className="border-t border-border bg-card px-4 py-3">
			{attachments.length > 0 && (
				<div className="mb-2 flex gap-2 overflow-x-auto pb-1">
					{attachments.map(attachment => (
						<div key={attachment.id} className="relative shrink-0">
							<img
								src={attachment.previewUrl}
								alt="Attachment preview"
								className="h-14 w-14 rounded-lg object-cover"
							/>
							<button
								type="button"
								className="absolute -right-1 -top-1 rounded-full bg-black/70 p-0.5 text-white"
								onClick={() => removeAttachment(attachment.id)}
							>
								<X className="h-3 w-3" />
							</button>
						</div>
					))}
				</div>
			)}
			<div className="flex items-center gap-1 rounded-full border bg-background px-2 py-1">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" className="h-8 w-8" disabled={disabled}>
							<Smile className="h-4 w-4" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start" className="flex flex-wrap gap-2 p-2">
						{emojis.map(emoji => (
							<DropdownMenuItem
								key={emoji}
								className="text-lg"
								onClick={() => onChange(`${value}${emoji}`)}
							>
								{emoji}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8"
					disabled={disabled || isUploading || attachments.length >= 5}
					onClick={() => fileInputRef.current?.click()}
				>
					<ImagePlus className="h-4 w-4" />
				</Button>
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					multiple
					className="hidden"
					onChange={handlePickAttachment}
				/>
				<Input
					placeholder={disabled ? 'Chat disabled' : 'Type a message...'}
					className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0"
					value={value}
					onChange={event => {
						onChange(event.target.value);
						onTyping?.();
					}}
					onKeyDown={event => {
						if (event.key === 'Enter' && !event.shiftKey) {
							event.preventDefault();
							handleSendClick();
						}
					}}
					disabled={disabled}
				/>
				<Button
					size="icon"
					className="h-8 w-8 rounded-full"
					onClick={handleSendClick}
					disabled={disabled || isUploading || (!value.trim() && attachments.length === 0)}
				>
					<Send className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}
