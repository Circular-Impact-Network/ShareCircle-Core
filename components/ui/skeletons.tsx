import { cn } from '@/lib/utils';

function Shimmer({ className }: { className?: string }) {
	return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

/** Full-page skeleton shown while dynamic imports load */
export function PageSkeleton() {
	return (
		<div className="flex-1 space-y-6 p-4 sm:p-6">
			<div className="space-y-2">
				<Shimmer className="h-8 w-48" />
				<Shimmer className="h-4 w-72" />
			</div>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 6 }).map((_, i) => (
					<ItemCardSkeleton key={i} />
				))}
			</div>
		</div>
	);
}

/** Matches ItemSummaryCard layout */
export function ItemCardSkeleton() {
	return (
		<div className="overflow-hidden rounded-xl border border-border/60 bg-card">
			<Shimmer className="aspect-[4/3] w-full rounded-none" />
			<div className="space-y-2.5 p-3">
				<Shimmer className="h-5 w-3/4" />
				<Shimmer className="h-3.5 w-full" />
				<Shimmer className="h-3.5 w-2/3" />
				<div className="flex gap-1.5 pt-1">
					<Shimmer className="h-5 w-14 rounded-full" />
					<Shimmer className="h-5 w-14 rounded-full" />
				</div>
				<div className="flex items-center gap-2 pt-1">
					<Shimmer className="h-5 w-5 rounded-full" />
					<Shimmer className="h-3.5 w-20" />
				</div>
			</div>
		</div>
	);
}

/** Grid of item card skeletons */
export function ItemGridSkeleton({ count = 6 }: { count?: number }) {
	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{Array.from({ length: count }).map((_, i) => (
				<ItemCardSkeleton key={i} />
			))}
		</div>
	);
}

/** Matches request card layout */
export function RequestCardSkeleton() {
	return (
		<div className="rounded-xl border border-border/60 bg-card p-4">
			<div className="space-y-3">
				<div className="flex items-start justify-between">
					<div className="space-y-1.5 flex-1">
						<Shimmer className="h-5 w-2/3" />
						<Shimmer className="h-3.5 w-full" />
					</div>
					<Shimmer className="ml-3 h-6 w-16 rounded-full" />
				</div>
				<div className="flex items-center gap-2">
					<Shimmer className="h-5 w-5 rounded-full" />
					<Shimmer className="h-3.5 w-24" />
					<Shimmer className="h-3.5 w-16" />
				</div>
			</div>
		</div>
	);
}

/** Dashboard 3-column card grid skeleton */
export function DashboardCardSkeleton() {
	return (
		<div className="rounded-xl border border-border/60 bg-card p-4">
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<Shimmer className="h-5 w-32" />
					<Shimmer className="h-4 w-4 rounded" />
				</div>
				<Shimmer className="h-3.5 w-48" />
				<div className="space-y-2 pt-2">
					<Shimmer className="h-16 w-full rounded-md" />
					<Shimmer className="h-16 w-full rounded-md" />
					<Shimmer className="h-16 w-full rounded-md" />
				</div>
			</div>
		</div>
	);
}

/** Single notification list item skeleton */
export function NotificationSkeleton() {
	return (
		<div className="flex gap-3 rounded-lg border border-border/60 bg-card p-3">
			<Shimmer className="h-9 w-9 shrink-0 rounded-full" />
			<div className="flex-1 space-y-1.5">
				<Shimmer className="h-4 w-3/4" />
				<Shimmer className="h-3.5 w-full" />
				<Shimmer className="h-3 w-20" />
			</div>
		</div>
	);
}

/** List of notification skeletons */
export function NotificationListSkeleton({ count = 5 }: { count?: number }) {
	return (
		<div className="space-y-2">
			{Array.from({ length: count }).map((_, i) => (
				<NotificationSkeleton key={i} />
			))}
		</div>
	);
}

/** Compact 2-line skeleton that fits inside dashboard card content */
export function DashboardItemSkeleton() {
	return (
		<div className="space-y-1 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
			<Shimmer className="h-4 w-3/4" />
			<Shimmer className="h-3 w-1/2" />
		</div>
	);
}

/** List of request card skeletons */
export function RequestCardListSkeleton({ count = 3 }: { count?: number }) {
	return (
		<div className="space-y-3">
			{Array.from({ length: count }).map((_, i) => (
				<RequestCardSkeleton key={i} />
			))}
		</div>
	);
}
