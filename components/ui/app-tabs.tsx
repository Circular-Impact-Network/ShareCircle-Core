'use client';

import type { ComponentProps, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type PageTabsProps = ComponentProps<typeof Tabs>;
type PageTabsListProps = ComponentProps<typeof TabsList>;
type PageTabsContentProps = ComponentProps<typeof TabsContent>;
type PageTabsTriggerProps = ComponentProps<typeof TabsTrigger> & {
	badge?: ReactNode;
};

export function PageTabs({ className, ...props }: PageTabsProps) {
	return <Tabs className={cn('w-full space-y-6', className)} {...props} />;
}

export function PageTabsList({ className, ...props }: PageTabsListProps) {
	return (
		<TabsList
			className={cn(
				'inline-flex h-auto w-full flex-wrap items-center justify-start gap-1 rounded-xl border border-border/70 bg-muted/40 p-1 sm:w-auto',
				className,
			)}
			{...props}
		/>
	);
}

export function PageTabsTrigger({ className, children, badge, ...props }: PageTabsTriggerProps) {
	return (
		<TabsTrigger
			className={cn('min-h-10 rounded-lg px-3 py-2 text-sm font-medium sm:px-4 [&>svg]:size-4', className)}
			{...props}
		>
			<span className="inline-flex min-w-0 items-center gap-2">
				{children}
				{badge === undefined || badge === null ? null : (
					<Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-[11px]">
						{badge}
					</Badge>
				)}
			</span>
		</TabsTrigger>
	);
}

export function PageTabsContent({ className, ...props }: PageTabsContentProps) {
	return <TabsContent className={cn('space-y-4', className)} {...props} />;
}
