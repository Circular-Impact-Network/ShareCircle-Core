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
	return <Tabs className={cn('w-full space-y-4 sm:space-y-6', className)} {...props} />;
}

export function PageTabsList({ className, ...props }: PageTabsListProps) {
	return (
		<TabsList
			className={cn(
				'flex h-auto w-full items-center justify-start gap-0.5 rounded-xl border border-border/70 bg-muted/40 p-0.5 sm:gap-1 sm:p-1',
				'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
				className,
			)}
			{...props}
		/>
	);
}

export function PageTabsTrigger({ className, children, badge, ...props }: PageTabsTriggerProps) {
	return (
		<TabsTrigger
			className={cn(
				'min-h-7 shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium sm:min-h-9 sm:rounded-lg sm:px-3 sm:py-1.5 sm:text-sm [&>svg]:size-3.5 sm:[&>svg]:size-4',
				className,
			)}
			{...props}
		>
			<span className="inline-flex min-w-0 items-center gap-1.5">
				{children}
				{badge === undefined || badge === null ? null : (
					<Badge variant="secondary" className="h-4 min-w-[16px] px-1 text-[10px] sm:h-5 sm:min-w-[20px] sm:px-1.5 sm:text-[11px]">
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
