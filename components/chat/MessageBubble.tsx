import { memo } from 'react';
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

export const MessageBubble = memo(function MessageBubble({ message, isOwn, onRetry, highlight }: MessageBubbleProps) {
	const state = getDeliveryState(message);
	const showRetry = state === 'failed';
	return (
		<div className={cn('flex', isOwn ? 'justify-end' : 'justify-start')}>
			<div
				className={cn(
					'max-w-[75%] rounded-lg px-4 py-2 text-sm shadow-sm',
					isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
				)}
			>
				<p>{highlight ? highlightText(message.body, highlight) : message.body}</p>
				<div className="mt-1 flex items-center justify-end gap-2 text-[11px] opacity-70">
					<span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
					{isOwn && (
						<span className="flex items-center gap-1">
							{state === 'sending' && <Check className="h-3 w-3" />}
							{state === 'sent' && <Check className="h-3 w-3" />}
							{state === 'delivered' && <CheckCheck className="h-3 w-3" />}
							{state === 'read' && <CheckCheck className="h-3 w-3 text-blue-500" />}
							{state === 'failed' && <AlertCircle className="h-3 w-3 text-destructive" />}
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
