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
				'mx-auto w-full max-w-7xl px-4 sm:px-5 lg:px-6 xl:px-7 py-5 sm:py-6 lg:py-7',
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
				'flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4',
				className,
			)}
		>
			<div className={cn('space-y-2', align === 'center' && 'text-center sm:text-left')}>
				<h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
				{description ? <p className="text-sm text-muted-foreground sm:text-base">{description}</p> : null}
			</div>
			{actions}
		</div>
	);
}

