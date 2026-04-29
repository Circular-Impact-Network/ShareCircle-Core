// Renders message body, image attachments, and delivery receipts
import { memo } from 'react';
import type React from 'react';
import { AlertCircle, Check, CheckCheck, RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChatMessage } from './types';

type MessageBubbleProps = {
	message: ChatMessage;
	isOwn: boolean;
	onRetry?: (message: ChatMessage) => void;
	highlight?: string;
};

// Custom comparison function for memo - only re-render when relevant props change
function arePropsEqual(prevProps: MessageBubbleProps, nextProps: MessageBubbleProps) {
	return (
		prevProps.message.id === nextProps.message.id &&
		prevProps.message.body === nextProps.message.body &&
		prevProps.message.localStatus === nextProps.message.localStatus &&
		prevProps.message.attachments === nextProps.message.attachments &&
		prevProps.message.receipts === nextProps.message.receipts &&
		prevProps.isOwn === nextProps.isOwn &&
		prevProps.highlight === nextProps.highlight
	);
}

function getDeliveryState(message: ChatMessage) {
	if (message.localStatus) {
		return message.localStatus;
	}

	const receipts = message.receipts || [];
	if (receipts.some(receipt => receipt.readAt)) {
		return 'read';
	}
	if (receipts.some(receipt => receipt.deliveredAt)) {
		return 'delivered';
	}
	return 'sent';
}

function highlightText(text: string, query: string) {
	if (!query.trim()) return text;
	const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const regex = new RegExp(`(${safeQuery})`, 'gi');
	const parts = text.split(regex);
	return parts.map((part, index) =>
		part.toLowerCase() === query.trim().toLowerCase() ? (
			<span key={`${part}-${index}`} className="rounded bg-yellow-200/70 px-1 text-foreground">
				{part}
			</span>
		) : (
			part
		),
	);
}

const URL_REGEX = /(\bhttps?:\/\/[^\s<>"{}|\\^`[\]]+|\bwww\.[^\s<>"{}|\\^`[\]]+)/gi;

function parseMessageContent(text: string, highlight?: string, isOwn?: boolean): React.ReactNode[] {
	const parts = text.split(URL_REGEX);
	return parts.map((part, i) => {
		if (URL_REGEX.test(part)) {
			URL_REGEX.lastIndex = 0;
			const href = part.startsWith('http') ? part : `https://${part}`;
			return (
				<a
					key={i}
					href={href}
					target="_blank"
					rel="noopener noreferrer"
					className={cn(
						'underline underline-offset-2 break-all',
						isOwn ? 'text-blue-200' : 'text-blue-500',
					)}
					onClick={e => e.stopPropagation()}
				>
					{part}
				</a>
			);
		}
		if (highlight && highlight.trim()) {
			return <span key={i}>{highlightText(part, highlight)}</span>;
		}
		return part;
	});
}

export const MessageBubble = memo(function MessageBubble({ message, isOwn, onRetry, highlight }: MessageBubbleProps) {
	const state = getDeliveryState(message);
	const showRetry = state === 'failed';
	const hasText = Boolean(message.body?.trim());
	const hasAttachments = message.attachments.length > 0;
	const imageOnly = hasAttachments && !hasText;

	return (
		<div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
			<div
				className={cn(
					'max-w-[80%] text-sm md:max-w-[75%]',
					imageOnly
						? 'rounded-xl p-0 shadow-none'
						: cn(
								'px-3.5 py-2.5 shadow-sm ring-1',
								// WhatsApp-style tails: own messages have no bottom-right radius, others no bottom-left
								isOwn
									? 'rounded-t-2xl rounded-bl-2xl rounded-br-sm bg-primary text-primary-foreground ring-black/10'
									: 'rounded-t-2xl rounded-br-2xl rounded-bl-sm bg-muted text-foreground ring-border/60',
							),
				)}
			>
				{hasAttachments && (
					<div
						className={cn(
							'grid gap-1.5 overflow-hidden rounded-xl',
							message.attachments.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
						)}
					>
						{message.attachments.map(attachment => (
							<img
								key={attachment.id}
								src={attachment.url}
								alt="Message attachment"
								className={cn(
									'w-full rounded-xl object-cover',
									message.attachments.length > 1 ? 'h-32' : 'max-h-72',
								)}
							/>
						))}
					</div>
				)}
				{hasText && (
					<p className={cn('whitespace-pre-wrap break-words', hasAttachments ? 'mt-2' : '')}>
						{parseMessageContent(message.body, highlight, isOwn)}
					</p>
				)}
				<div className="mt-1.5 flex items-center justify-end gap-1.5 text-[10px] opacity-75">
					<span>
						{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
					</span>
					{isOwn && (
						<span className="flex items-center">
							{(state === 'sending' || state === 'sent') && <Check className="h-3 w-3" />}
							{state === 'delivered' && <CheckCheck className="h-3 w-3 opacity-60" />}
							{state === 'read' && <CheckCheck className="h-3 w-3 text-blue-400 opacity-100" />}
							{state === 'failed' && <AlertCircle className="h-3 w-3 text-destructive opacity-100" />}
						</span>
					)}
				</div>
				{showRetry && onRetry && (
					<button
						type="button"
						onClick={() => onRetry(message)}
						className="mt-2 inline-flex items-center gap-2 text-xs text-destructive"
					>
						<RefreshCcw className="h-3 w-3" />
						Retry
					</button>
				)}
			</div>
		</div>
	);
}, arePropsEqual);
