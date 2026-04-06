import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
	icon?: LucideIcon;
	title: string;
	description: string;
	action?: ReactNode;
	className?: string;
	iconClassName?: string;
}

export function EmptyState({
	icon: Icon = Package,
	title,
	description,
	action,
	className,
	iconClassName,
}: EmptyStateProps) {
	return (
		<Card className={cn('border-dashed border-border/70 bg-card', className)}>
			<CardContent className="flex flex-col items-center gap-4 py-12 text-center">
				<div
					className={cn(
						'mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10',
						iconClassName,
					)}
				>
					<Icon className="h-7 w-7 text-primary" />
				</div>
				<div className="space-y-1">
					<p className="font-medium text-foreground">{title}</p>
					<p className="text-sm text-muted-foreground">{description}</p>
				</div>
				{action}
			</CardContent>
		</Card>
	);
}
