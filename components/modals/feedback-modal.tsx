'use client';

import { useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { CheckCircle2, Paperclip, Star, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const APP_VERSION = '1.0';

const CATEGORIES = ['Bug', 'Feature idea', 'General', "What's working"] as const;
type Category = (typeof CATEGORIES)[number];

const TASK_CONTEXTS = [
	'Browsing items',
	'Borrowing an item',
	'Lending my item',
	'Managing a circle',
	'Messaging',
	'Setting up my profile',
	'Something else',
] as const;

function getDeviceType() {
	const ua = navigator.userAgent;
	if (/Mobi|Android/i.test(ua)) return 'mobile';
	if (/Tablet|iPad/i.test(ua)) return 'tablet';
	return 'desktop';
}

interface FeedbackModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
	const pathname = usePathname();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [rating, setRating] = useState(0);
	const [hovered, setHovered] = useState(0);
	const [category, setCategory] = useState<Category | null>(null);
	const [taskContext, setTaskContext] = useState<string | null>(null);
	const [message, setMessage] = useState('');
	const [followUpConsent, setFollowUpConsent] = useState(true);
	const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitted, setSubmitted] = useState(false);

	const isMessageRequired = (rating > 0 && rating <= 3) || category === 'Bug';
	const canSubmit = rating > 0 && category !== null && (!isMessageRequired || message.trim().length > 0) && !isSubmitting;

	const reset = () => {
		setRating(0);
		setHovered(0);
		setCategory(null);
		setTaskContext(null);
		setMessage('');
		setFollowUpConsent(true);
		setAttachmentFiles([]);
		setIsSubmitting(false);
		setSubmitted(false);
	};

	const handleOpenChange = (next: boolean) => {
		if (!next) reset();
		onOpenChange(next);
	};

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const picked = Array.from(e.target.files ?? []);
		if (picked.length) setAttachmentFiles(prev => [...prev, ...picked]);
		e.target.value = '';
	};

	const removeFile = (index: number) => {
		setAttachmentFiles(prev => prev.filter((_, i) => i !== index));
	};

	const handleSubmit = async () => {
		if (!canSubmit) return;
		setIsSubmitting(true);
		try {
			const paths: string[] = [];
			for (const file of attachmentFiles) {
				const fd = new FormData();
				fd.append('file', file);
				const res = await fetch('/api/upload/image?bucket=attachments', { method: 'POST', body: fd });
				if (res.ok) {
					const data = await res.json();
					if (data.path) paths.push(data.path);
				}
			}

			await fetch('/api/feedback', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					rating,
					category,
					message: message.trim() || null,
					currentPage: pathname,
					deviceType: getDeviceType(),
					appVersion: APP_VERSION,
					followUpConsent,
					taskContext,
					attachmentPath: paths.length ? JSON.stringify(paths) : null,
				}),
			});

			setSubmitted(true);
			setTimeout(() => handleOpenChange(false), 2200);
		} catch {
			// fail silently — feedback should never block the user
		} finally {
			setIsSubmitting(false);
		}
	};

	const activeStars = hovered || rating;

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-md">
				{submitted ? (
					<div className="flex flex-col items-center gap-4 py-8 text-center">
						<div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
							<CheckCircle2 className="h-8 w-8 text-primary" />
						</div>
						<div className="space-y-1">
							<h3 className="text-lg font-semibold">Thank you!</h3>
							<p className="text-sm text-muted-foreground">
								Your feedback helps us make ShareCircle better for everyone.
							</p>
						</div>
					</div>
				) : (
					<>
						<DialogHeader>
							<DialogTitle>Share your feedback</DialogTitle>
							<DialogDescription>Help us improve — it only takes a moment.</DialogDescription>
						</DialogHeader>

						<div className="space-y-5 pt-1">
							{/* Star Rating */}
							<div className="space-y-2">
								<p className="text-sm font-medium">How&apos;s your experience so far?</p>
								<div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
									{[1, 2, 3, 4, 5].map(star => (
										<button
											key={star}
											type="button"
											onClick={() => setRating(star)}
											onMouseEnter={() => setHovered(star)}
											aria-label={`${star} star${star > 1 ? 's' : ''}`}
											className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										>
											<Star
												className={cn(
													'h-8 w-8 transition-colors',
													star <= activeStars
														? 'fill-amber-400 text-amber-400'
														: 'fill-muted text-muted-foreground/40',
												)}
											/>
										</button>
									))}
								</div>
							</div>

							{/* Category Pills */}
							<div className="space-y-2">
								<p className="text-sm font-medium">What&apos;s this about?</p>
								<div className="flex flex-wrap gap-2">
									{CATEGORIES.map(cat => (
										<button
											key={cat}
											type="button"
											onClick={() => setCategory(cat)}
											className={cn(
												'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
												category === cat
													? 'border-primary bg-primary text-primary-foreground'
													: 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted',
											)}
										>
											{cat}
										</button>
									))}
								</div>
							</div>

							{/* Task Context */}
							<div className="space-y-2">
								<p className="text-sm font-medium">
									What were you trying to do?{' '}
									<span className="font-normal text-muted-foreground">(optional)</span>
								</p>
								<Select onValueChange={v => setTaskContext(v)} value={taskContext ?? ''}>
									<SelectTrigger>
										<SelectValue placeholder="Select a task…" />
									</SelectTrigger>
									<SelectContent>
										{TASK_CONTEXTS.map(ctx => (
											<SelectItem key={ctx} value={ctx}>
												{ctx}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Message */}
							<div className="space-y-2">
								<p className="text-sm font-medium">
									Share the details{' '}
									{isMessageRequired ? (
										<span className="font-normal text-destructive">
											(required for low ratings &amp; bug reports)
										</span>
									) : (
										<span className="font-normal text-muted-foreground">(optional)</span>
									)}
								</p>
								<Textarea
									placeholder="The more specific you are, the more we can act on it."
									value={message}
									onChange={e => setMessage(e.target.value)}
									rows={3}
									maxLength={2000}
									className="resize-none"
								/>
							</div>

							{/* Screenshot Upload */}
							<div className="space-y-2">
								<p className="text-sm font-medium">
									Screenshots{' '}
									<span className="font-normal text-muted-foreground">(optional)</span>
								</p>
								<input
									ref={fileInputRef}
									type="file"
									accept="image/jpeg,image/png,image/gif,image/webp"
									multiple
									className="hidden"
									onChange={handleFileSelect}
								/>
								{attachmentFiles.length > 0 && (
									<div className="space-y-1.5">
										{attachmentFiles.map((file, i) => (
											<div
												key={i}
												className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
											>
												<Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
												<span className="truncate flex-1 text-foreground">{file.name}</span>
												<button
													type="button"
													onClick={() => removeFile(i)}
													className="shrink-0 text-muted-foreground hover:text-foreground"
													aria-label="Remove file"
												>
													<X className="h-4 w-4" />
												</button>
											</div>
										))}
									</div>
								)}
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => fileInputRef.current?.click()}
								>
									<Paperclip className="mr-1.5 h-3.5 w-3.5" />
									{attachmentFiles.length > 0 ? 'Add more' : 'Upload screenshot'}
								</Button>
							</div>

							{/* Follow-up Consent */}
							<div className="flex items-center justify-between gap-3">
								<p className="text-sm text-foreground">OK to follow up with you about this?</p>
								<div className="flex items-center gap-2 shrink-0">
									<span className="text-xs text-muted-foreground">{followUpConsent ? 'Yes' : 'No'}</span>
									<Switch checked={followUpConsent} onCheckedChange={setFollowUpConsent} />
								</div>
							</div>

							<Button onClick={handleSubmit} disabled={!canSubmit} className="w-full">
								{isSubmitting ? 'Sending…' : 'Send feedback'}
							</Button>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
