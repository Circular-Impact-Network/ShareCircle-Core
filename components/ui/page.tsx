import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface PageStickyHeaderProps {
	children: ReactNode;
	className?: string;
}

export function PageStickyHeader({ children, className }: PageStickyHeaderProps) {
	return (
		<div
			className={cn(
				'sticky top-0 z-10',
				'bg-background/95 backdrop-blur-sm',
				'-mx-4 px-4 sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6 xl:-mx-7 xl:px-7',
				className,
			)}
		>
			{children}
		</div>
	);
}

interface PageShellProps {
	children: ReactNode;
	className?: string;
}

export function PageShell({ children, className }: PageShellProps) {
	return (
		<div className={cn('mx-auto w-full max-w-7xl px-4 sm:px-5 lg:px-6 xl:px-7 pt-3 pb-5 sm:py-6 lg:py-7', className)}>
			{children}
		</div>
	);
}

interface PageHeaderProps {
	title: string;
	description?: string;
	actions?: ReactNode;
	className?: string;
	align?: 'start' | 'center';
}

export function PageHeader({ title, description, actions, className, align = 'start' }: PageHeaderProps) {
	return (
		<div className={cn('flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4', className)}>
			<div className={cn('space-y-0.5 sm:space-y-1.5', align === 'center' && 'text-center sm:text-left')}>
				<h1 className="text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl">{title}</h1>
				{description ? <p className="text-xs text-muted-foreground sm:text-sm">{description}</p> : null}
			</div>
			{actions}
		</div>
	);
}
