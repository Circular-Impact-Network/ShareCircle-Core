'use client';

import { Package, PackageOpen, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContextRef } from '@/lib/chat-context-ref';

type ContextRefChipProps = {
	contextRef: ContextRef;
	// Visual variant. `composer` is the dismissable pill above the input;
	// `bubble` is the clickable card inside a sent/received message bubble.
	variant: 'composer' | 'bubble-own' | 'bubble-other';
	onClick?: () => void;
	onClear?: () => void;
};

export function ContextRefChip({ contextRef, variant, onClick, onClear }: ContextRefChipProps) {
	const Icon = contextRef.type === 'item' ? Package : PackageOpen;
	const label = contextRef.type === 'item' ? 'Item' : 'Request';

	const isComposer = variant === 'composer';
	const isOwn = variant === 'bubble-own';
	const isClickable = Boolean(onClick);

	const containerClasses = cn(
		'flex items-center gap-2 rounded-lg border-l-4 text-left transition-colors',
		isComposer ? 'mb-2 border-primary bg-muted/60 px-3 py-2' : 'mb-2 w-full px-2 py-1.5',
		!isComposer && isOwn && 'border-primary-foreground/80 bg-primary-foreground/10',
		!isComposer && isOwn && isClickable && 'hover:bg-primary-foreground/20',
		!isComposer && !isOwn && 'border-primary bg-background/70',
		!isComposer && !isOwn && isClickable && 'hover:bg-background',
	);

	const iconColor = !isComposer && isOwn ? 'text-primary-foreground' : 'text-primary';
	const labelColor = !isComposer && isOwn ? 'text-primary-foreground/80' : 'text-primary';
	const labelSize = isComposer ? 'text-[11px]' : 'text-[10px]';
	const titleSize = isComposer ? 'text-sm' : 'text-xs';

	const body = (
		<>
			<div className={cn('shrink-0', iconColor)}>
				<Icon className="h-4 w-4" />
			</div>
			{contextRef.imageUrl && (
				<img src={contextRef.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
			)}
			<div className="min-w-0 flex-1">
				<p className={cn('font-medium uppercase tracking-wide', labelSize, labelColor)}>{label}</p>
				<p className={cn('truncate font-medium', titleSize)}>{contextRef.title}</p>
			</div>
			{isComposer && onClear && (
				<button
					type="button"
					aria-label="Remove reference"
					data-testid="context-ref-chip-clear"
					className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-background hover:text-foreground"
					onClick={e => {
						e.stopPropagation();
						onClear();
					}}
				>
					<X className="h-3.5 w-3.5" />
				</button>
			)}
		</>
	);

	const testIdValue = isComposer ? 'context-ref-chip-composer' : isOwn ? 'context-ref-chip-own' : 'context-ref-chip-other';

	if (isClickable) {
		return (
			<button type="button" onClick={onClick} className={containerClasses} data-testid={testIdValue}>
				{body}
			</button>
		);
	}

	return <div className={containerClasses} data-testid={testIdValue}>{body}</div>;
}
