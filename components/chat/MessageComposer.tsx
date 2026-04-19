// Composer with image attachments (upload to attachments bucket) and send
import { Camera, ImagePlus, Send, Smile, X } from 'lucide-react';
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { MAX_MEDIA_ATTACHMENTS, getUploadValidationError, prepareImageForUpload } from '@/lib/media';

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
	const { toast } = useToast();
	const isDesktop = useMediaQuery('(min-width: 768px)');
	const isOnline = useOnlineStatus();
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const cameraInputRef = useRef<HTMLInputElement | null>(null);
	const [attachments, setAttachments] = useState<{ id: string; file: File; previewUrl: string }[]>([]);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadProgressLabel, setUploadProgressLabel] = useState('');

	useEffect(() => {
		return () => {
			for (const attachment of attachments) {
				URL.revokeObjectURL(attachment.previewUrl);
			}
		};
	}, [attachments]);

	const queueAttachments = async (files: File[]) => {
		if (files.length === 0 || disabled) return;

		if (!isOnline) {
			toast({
				title: 'Connection required',
				description: 'Photo attachments need an internet connection.',
				variant: 'destructive',
			});
			return;
		}

		if (attachments.length + files.length > MAX_MEDIA_ATTACHMENTS) {
			toast({
				title: 'Too many photos',
				description: `You can attach up to ${MAX_MEDIA_ATTACHMENTS} photos in one message.`,
				variant: 'destructive',
			});
			return;
		}

		const nextAttachments: { id: string; file: File; previewUrl: string }[] = [];

		for (const file of files) {
			const typeError = getUploadValidationError(file, { maxSizeBytes: Number.MAX_SAFE_INTEGER });
			if (typeError) {
				toast({
					title: 'Unsupported image',
					description: typeError,
					variant: 'destructive',
				});
				continue;
			}

			const preparedFile = await prepareImageForUpload(file);
			const validationError = getUploadValidationError(preparedFile);
			if (validationError) {
				toast({
					title: 'Image too large',
					description: validationError,
					variant: 'destructive',
				});
				continue;
			}

			nextAttachments.push({
				id: crypto.randomUUID(),
				file: preparedFile,
				previewUrl: URL.createObjectURL(preparedFile),
			});
		}

		if (nextAttachments.length > 0) {
			setAttachments(prev => [...prev, ...nextAttachments]);
		}
	};

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
		void queueAttachments(files);
		event.target.value = '';
	};

	const handleSendClick = async () => {
		const hasBody = value.trim().length > 0;
		if (!hasBody && attachments.length === 0) return;
		if (!isOnline) {
			toast({
				title: 'Connection required',
				description: 'Reconnect before sending messages or photo attachments.',
				variant: 'destructive',
			});
			return;
		}

		setIsUploading(true);
		setUploadProgressLabel('');
		try {
			const uploadedAttachments: { type: 'IMAGE'; path: string; url: string }[] = [];
			for (const [index, attachment] of attachments.entries()) {
				setUploadProgressLabel(`Uploading ${index + 1} of ${attachments.length}`);
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
				uploadedAttachments.push({
					type: 'IMAGE',
					path: data.path as string,
					url: data.url as string,
				});
			}

			onSend({ attachments: uploadedAttachments });
			setAttachments(prev => {
				for (const attachment of prev) {
					URL.revokeObjectURL(attachment.previewUrl);
				}
				return [];
			});
		} catch (error) {
			console.error('Attachment upload failed:', error);
			toast({
				title: 'Attachment upload failed',
				description: 'Please try again with a stable connection.',
				variant: 'destructive',
			});
		} finally {
			setIsUploading(false);
			setUploadProgressLabel('');
		}
	};

	return (
		<div className="border-t border-border/70 bg-card/95 px-4 py-3">
			{attachments.length > 0 && (
				<div className="mb-3 space-y-2">
					<div className="app-scrollbar app-scrollbar-thin flex gap-2 overflow-x-auto pb-1">
						{attachments.map(attachment => (
							<div
								key={attachment.id}
								className="relative shrink-0 rounded-2xl border border-border/70 bg-background p-1"
							>
								<img
									src={attachment.previewUrl}
									alt="Attachment preview"
									className="h-14 w-14 rounded-xl object-cover"
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
					{isUploading && uploadProgressLabel && (
						<p className="text-xs text-muted-foreground">{uploadProgressLabel}</p>
					)}
				</div>
			)}
			<div className="flex items-center gap-1 rounded-2xl border border-border/70 bg-background px-2 py-1.5 shadow-sm">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" disabled={disabled}>
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
				{isDesktop ? (
					<Button
						variant="ghost"
						size="icon"
						className="h-9 w-9 rounded-xl"
						disabled={disabled || isUploading || attachments.length >= MAX_MEDIA_ATTACHMENTS}
						onClick={() => fileInputRef.current?.click()}
					>
						<ImagePlus className="h-4 w-4" />
					</Button>
				) : (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-9 w-9 rounded-xl"
								disabled={disabled || isUploading || attachments.length >= MAX_MEDIA_ATTACHMENTS}
							>
								<ImagePlus className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start">
							<DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
								<ImagePlus className="mr-2 h-4 w-4" />
								Choose from library
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => cameraInputRef.current?.click()}>
								<Camera className="mr-2 h-4 w-4" />
								Take photo
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					multiple
					className="hidden"
					onChange={handlePickAttachment}
				/>
				<input
					ref={cameraInputRef}
					type="file"
					accept="image/*"
					capture="environment"
					className="hidden"
					onChange={handlePickAttachment}
				/>
				<Input
					placeholder={disabled ? 'Chat disabled' : 'Type a message...'}
					className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0"
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
					className="h-9 w-9 rounded-xl"
					onClick={handleSendClick}
					disabled={disabled || isUploading || (!value.trim() && attachments.length === 0)}
				>
					<Send className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}
