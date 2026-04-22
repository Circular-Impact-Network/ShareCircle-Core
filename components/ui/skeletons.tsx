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

/** Circle card skeleton (matches grid/list view cards) */
export function CircleCardSkeleton() {
	return (
		<div className="rounded-xl border border-border/60 bg-card p-5">
			<div className="space-y-3">
				<div className="flex items-start justify-between">
					<div className="space-y-1.5 flex-1">
						<Shimmer className="h-5 w-2/5" />
						<Shimmer className="h-3.5 w-3/5" />
					</div>
					<Shimmer className="ml-3 h-6 w-16 rounded-full" />
				</div>
				<div className="flex items-center gap-2 pt-1">
					<div className="flex -space-x-1">
						{Array.from({ length: 3 }).map((_, i) => (
							<Shimmer key={i} className="h-6 w-6 rounded-full ring-2 ring-background" />
						))}
					</div>
					<Shimmer className="h-3.5 w-24" />
				</div>
				<div className="flex gap-2 pt-1">
					<Shimmer className="h-8 flex-1 rounded-lg" />
					<Shimmer className="h-8 w-8 rounded-lg" />
				</div>
			</div>
		</div>
	);
}

/** Grid of circle card skeletons */
export function CircleGridSkeleton({ count = 6 }: { count?: number }) {
	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{Array.from({ length: count }).map((_, i) => (
				<CircleCardSkeleton key={i} />
			))}
		</div>
	);
}

/** Full circle detail page loading skeleton */
export function CircleDetailSkeleton() {
	return (
		<div className="space-y-6 p-4 sm:p-5 lg:p-6">
			<div className="flex items-center gap-3">
				<Shimmer className="h-8 w-8 rounded-lg" />
				<Shimmer className="h-6 w-40" />
			</div>
			<div className="rounded-xl border border-border/60 bg-card p-5 space-y-4">
				<div className="flex items-start justify-between">
					<div className="space-y-2 flex-1">
						<Shimmer className="h-7 w-52" />
						<Shimmer className="h-4 w-80" />
					</div>
					<Shimmer className="ml-4 h-8 w-20 rounded-lg" />
				</div>
				<div className="flex gap-3 pt-2">
					<Shimmer className="h-5 w-20 rounded-full" />
					<Shimmer className="h-5 w-28 rounded-full" />
				</div>
			</div>
			<div className="flex gap-1 rounded-xl border border-border/70 bg-muted/40 p-1">
				<Shimmer className="h-10 flex-1 rounded-lg" />
				<Shimmer className="h-10 flex-1 rounded-lg" />
			</div>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{Array.from({ length: 3 }).map((_, i) => (
					<ItemCardSkeleton key={i} />
				))}
			</div>
		</div>
	);
}

/** Full item detail page loading skeleton */
export function ItemDetailSkeleton() {
	return (
		<div className="space-y-6 p-4 sm:p-5 lg:p-6">
			<div className="flex items-center gap-3">
				<Shimmer className="h-8 w-8 rounded-lg" />
				<Shimmer className="h-5 w-36" />
			</div>
			<div className="grid gap-6 lg:grid-cols-2">
				<Shimmer className="aspect-[4/3] w-full rounded-xl" />
				<div className="space-y-4">
					<div className="space-y-2">
						<Shimmer className="h-8 w-3/4" />
						<Shimmer className="h-4 w-1/2" />
					</div>
					<div className="space-y-2">
						<Shimmer className="h-4 w-full" />
						<Shimmer className="h-4 w-full" />
						<Shimmer className="h-4 w-2/3" />
					</div>
					<div className="flex gap-2 pt-2">
						<Shimmer className="h-5 w-16 rounded-full" />
						<Shimmer className="h-5 w-20 rounded-full" />
					</div>
					<div className="flex items-center gap-3 pt-2">
						<Shimmer className="h-10 w-10 rounded-full" />
						<div className="space-y-1">
							<Shimmer className="h-4 w-32" />
							<Shimmer className="h-3 w-24" />
						</div>
					</div>
					<div className="flex gap-3 pt-4">
						<Shimmer className="h-11 flex-1 rounded-lg" />
						<Shimmer className="h-11 w-11 rounded-lg" />
					</div>
				</div>
			</div>
		</div>
	);
}

/** Notification preferences panel loading skeleton */
export function NotificationPrefsSkeleton() {
	return (
		<div className="space-y-4">
			{Array.from({ length: 3 }).map((_, i) => (
				<div key={i} className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
					<div className="flex items-center justify-between">
						<div className="space-y-1">
							<Shimmer className="h-5 w-40" />
							<Shimmer className="h-3.5 w-56" />
						</div>
						<Shimmer className="h-6 w-11 rounded-full" />
					</div>
				</div>
			))}
		</div>
	);
}
