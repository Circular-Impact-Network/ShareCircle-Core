import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface PageShellProps {
	children: ReactNode;
	className?: string;
}

export function PageShell({ children, className }: PageShellProps) {
	return (
		<div
			className={cn(
				'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10',
				className,
			)}
		>
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

export function PageHeader({
	title,
	description,
	actions,
	className,
	align = 'start',
}: PageHeaderProps) {
	return (
		<div
			className={cn(
				'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
				className,
			)}
		>
			<div className={cn('space-y-2', align === 'center' && 'text-center sm:text-left')}>
				<h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
				{description ? <p className="text-base text-muted-foreground sm:text-lg">{description}</p> : null}
			</div>
			{actions}
		</div>
	);
}

